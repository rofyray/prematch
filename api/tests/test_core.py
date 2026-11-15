import asyncio
import json
from datetime import date, datetime, timezone
import pytest
from pydantic import ValidationError
from backend.core.models import Claim,Verdict,Source,Quote,Correction,Citation,BriefRequest,Finding
from backend.core.scoring import score,label,repair_claims
from backend.core.rerank import rerank
from backend.core.citations import validate_quotes,validate_correction
from backend.core.findings import research_window,clean_findings,finding_status
from backend.core.cache import cache_key,Store
from backend.core.sse import encode,stream

TODAY=date(2026,11,14)
def source(**kwargs):
    return Source(id='s1',url='https://example.com/news',domain='example.com',title='News',published_date=TODAY,snippet='The current price is 20 dollars per month.',official=True,score=1,**kwargs)
def claim():
    return Claim(id='c1',text='The price is 10 dollars.',span=(0,24),category='pricing',volatility_days=30)

@pytest.mark.parametrize('verdict,expected,ui',[('current',100,'onside'),('partially_current',50,'tight'),('outdated',0,'offside'),('contradicted',0,'offside'),('unverifiable',None,'no_call')])
def test_scores(verdict,expected,ui):
    v=Verdict(label=verdict,confidence=1,supporting_source_ids=['s1'])
    result=score(v,claim(),[source()],TODAY)
    assert result.freshness==expected
    assert result.recheck_by==date(2026,12,14)
    assert label(result)==ui

def test_low_confidence_current_is_not_onside():
    s=source();s.official=False;s.published_date=None
    v=score(Verdict(label='current',confidence=0),claim(),[s],TODAY)
    assert v.freshness==56
    assert label(v)=='tight'

def test_repairs_spans_and_rejects_overlap():
    answer='Start. The price is 10 dollars. End.'
    good=claim();bad=claim();bad.text='Not present';duplicate=claim()
    repaired=repair_claims(answer,[good,bad,duplicate])
    assert len(repaired)==1
    assert answer[slice(*repaired[0].span)]==good.text
    assert repaired[0].volatility_days==30

def test_rerank_domain_cap_and_unsafe_urls():
    results=[{'url':f'https://a.com/{i}','score':1,'content':'x','published_date':str(TODAY)} for i in range(5)]
    results += [{'url':'https://b.com/1','score':.9},{'url':'javascript:alert(1)','score':1}]
    ranked=rerank(results,['a.com'],TODAY)
    assert len(ranked)==3
    assert sum(s.domain=='a.com' for s in ranked)==2
    assert ranked[0].score==pytest.approx(1)

def test_quote_validation_downgrades_unsupported_claims():
    v=Verdict(label='current',confidence=.9,quotes=[Quote(source_id='s1',text='The CEO is a new person.')])
    validated=validate_quotes(v,[source()])
    assert validated.label=='unverifiable'
    assert validated.confidence==.45
    valid=Verdict(label='outdated',confidence=.9,quotes=[Quote(source_id='s1',text='current price is 20 dollars')])
    assert len(validate_quotes(valid,[source()]).quotes)==1

def test_correction_rejects_broken_reference():
    with pytest.raises(ValueError):
        validate_correction(Correction(text='Now 20 [2]',citations=[Citation(n=1,source_id='s1')]),[source()])
    with pytest.raises(ValueError):
        validate_correction(Correction(text='Now 20 [1]',citations=[Citation(n=1,source_id='missing')]),[source()])

@pytest.mark.parametrize('meeting,end',[('2026-11-20T10:00:00-08:00','2026-11-14'),('2026-11-01T23:00:00-08:00','2026-11-02'),('2027-03-14T01:30:00-08:00','2026-11-14')])
def test_window(meeting,end):
    window=research_window(datetime.fromisoformat(meeting),datetime(2026,11,14,12,tzinfo=timezone.utc))
    assert str(window.end)==end
    assert (window.end-window.start).days==30

def test_meeting_requires_timezone():
    with pytest.raises(ValidationError):
        BriefRequest(subject='Acme',meeting_at='2026-11-14T10:00:00')

@pytest.mark.parametrize('domains,official,expected',[(['reddit.com'],False,'unconfirmed'),(['reuters.com'],False,'reported'),(['example.com'],True,'verified'),(['reuters.com','apnews.com'],False,'verified')])
def test_finding_status(domains,official,expected):
    sources=[]
    for i,domain in enumerate(domains):
        s=source();s.domain=domain;s.id=str(i);s.official=official;sources.append(s)
    assert finding_status(sources)==expected

def test_findings_drop_out_of_window_and_cluster_duplicates():
    window=research_window(datetime(2026,11,14,tzinfo=timezone.utc),datetime(2026,11,14,tzinfo=timezone.utc))
    f=Finding(id='f1',section='news',title='Product launch',date=TODAY,summary='A new product',source_ids=['s1'])
    old=f.model_copy(update={'id':'old','date':date(2026,1,1)})
    duplicate=f.model_copy(update={'id':'duplicate'})
    unknown=f.model_copy(update={'id':'unknown','source_ids':['missing']})
    assert [x.id for x in clean_findings([f,old,duplicate,unknown],[source()],window)]==['f1']
    undated=source();undated.published_date=None
    assert clean_findings([f],[undated],window)==[]

def test_cache_key_normalizes_query_and_parameter_order():
    assert cache_key(' A  QUERY ',{'x':1,'y':2},'d')==cache_key('a query',{'y':2,'x':1},'d')
    assert cache_key('a',{},'d')!=cache_key('a',{},'e')

@pytest.mark.asyncio
async def test_rate_limit_atomic(monkeypatch):
    monkeypatch.delenv('REDIS_URL',raising=False);monkeypatch.delenv('VERCEL',raising=False)
    store=Store()
    results=await asyncio.gather(*(store.allow('client','offside',now=1000) for _ in range(20)))
    assert sum(results)==6
    assert await store.allow('client','prematch',now=1000)
    assert await store.allow('client','offside',now=1601)

def test_sse_encoding():
    encoded=encode('claim.verdict',{'text':'hello\nworld','date':TODAY})
    assert encoded.startswith('event: claim.verdict\ndata: ')
    assert encoded.endswith('\n\n')
    assert json.loads(encoded.split('data: ')[1])['text']=='hello\nworld'

@pytest.mark.asyncio
async def test_sse_failure_ends_with_error():
    async def factory(emit):
        await emit('run.started',{'run_id':'test'})
        raise RuntimeError('private provider error')
    messages=[message async for message in stream(factory)]
    assert 'event: run.error' in messages[-1]
    assert 'private provider error' not in ''.join(messages)


def test_tavily_rfc_publication_dates_preserve_evidence():
    from backend.core.rerank import publication_date
    assert publication_date('Wed, 28 Oct 2026 20:47:40 GMT') == date(2026, 10, 28)
    assert publication_date('2026-10-28T23:30:00-07:00') == date(2026, 10, 29)
    assert publication_date('2026-10-28') == date(2026, 10, 28)
    assert publication_date('unknown') is None


@pytest.mark.asyncio
async def test_https_storage_operations(monkeypatch):
    import httpx,json
    from backend.core.cache import Store
    monkeypatch.setenv('STORAGE_URL','https://storage.example')
    monkeypatch.setenv('STORAGE_TOKEN','test-token')
    database={}
    def handler(request):
        assert request.headers['authorization']=='Bearer test-token'
        assert str(request.url)=='https://storage.example/command'
        body=json.loads(request.content)
        if body['operation']=='set':
            database[body['key']]=body['value'];result=True
        elif body['operation']=='get':result=database.get(body['key'])
        elif body['operation']=='allow':result=False
        else:result=True
        return httpx.Response(200,json={'result':result})
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs: original(transport=httpx.MockTransport(handler),**kwargs))
    store=Store()
    await store.set('run:test',{'saved':True},60)
    assert await store.get('run:test')=={'saved':True}
    assert await store.ping()
    assert not await store.allow('client','app')


@pytest.mark.asyncio
async def test_gateway_routes_effort_and_observes_fallback(monkeypatch):
    from types import SimpleNamespace
    from backend.core import llm
    from backend.core.telemetry import Run
    monkeypatch.setenv('BIFROST_URL','https://gateway.example')
    monkeypatch.setenv('BIFROST_VK','test-key')
    seen={}
    async def create(**kwargs):
        seen.update(kwargs)
        class Raw:
            headers={'x-bifrost-request-id':'request-1','x-bifrost-cache-hit':'true'}
            async def parse(self):
                return SimpleNamespace(model='gpt-6-luna',usage=SimpleNamespace(input_tokens=10,output_tokens=2),content=[SimpleNamespace(type='text',text='ready')])
        return Raw()
    class Client:
        def __init__(self,**kwargs):
            self.messages=SimpleNamespace(with_raw_response=SimpleNamespace(create=create))
        async def close(self):pass
    monkeypatch.setattr(llm.anthropic,'AsyncAnthropic',Client)
    async def emit(*args):pass
    run=Run('offside',emit)
    assert await llm.call(run,'Stepover','Extract claims.',{'answer':'test'})=='ready'
    assert seen['model']=='anthropic/claude-haiku-5-5'
    assert seen['extra_body']['output_config']=={'effort':'medium'}
    assert seen['extra_body']['fallbacks']==['openai/gpt-6-luna']
    assert run.telemetry.bifrost.cache_hits==1
    assert run.telemetry.bifrost.fallbacks==1
    assert run.telemetry.calls[0].bifrost_request_id=='request-1'


@pytest.mark.asyncio
async def test_gateway_stream_delivers_partial_before_final(monkeypatch):
    from types import SimpleNamespace
    from backend.core import llm
    from backend.core.telemetry import Run
    monkeypatch.setenv('BIFROST_URL','https://gateway.example')
    monkeypatch.setenv('BIFROST_VK','test-key')
    events=[]
    class Stream:
        response=SimpleNamespace(headers={'x-bifrost-request-id':'stream-1'})
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        def __aiter__(self):return self.iterate()
        async def iterate(self):
            yield SimpleNamespace(type='input_json',snapshot={'headline':[{'text':'First item','source_ids':['s1']}]})
        async def get_final_message(self):
            assert events
            return SimpleNamespace(model='claude-opus-5-5',usage=SimpleNamespace(input_tokens=10,output_tokens=3),content=[SimpleNamespace(type='text',text='complete')])
    class Client:
        def __init__(self,**kwargs):self.messages=SimpleNamespace(stream=lambda **kwargs:Stream())
        async def close(self):pass
    monkeypatch.setattr(llm.anthropic,'AsyncAnthropic',Client)
    async def partial(value):events.append(value)
    async def emit(*args):pass
    run=Run('prematch',emit)
    assert await llm.call(run,'Golazo','Write a brief.',{},on_partial=partial)=='complete'
    assert events[0]['headline'][0]['text']=='First item'
    assert run.telemetry.calls[0].bifrost_request_id=='stream-1'
