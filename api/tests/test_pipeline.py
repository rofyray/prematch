import pytest
from datetime import datetime,timezone
from backend.agents import prematch_graph as pipeline
from backend.core.models import Candidates,Candidate,BriefRequest
from backend.core.telemetry import Run

@pytest.mark.asyncio
async def test_ambiguous_entity_stops_before_research(monkeypatch):
    async def search(*args,**kwargs):return [{'title':'Mercury companies'}]
    async def call(run,agent,*args,**kwargs):
        assert agent=='Cruyff'
        return Candidates(candidates=[Candidate(name='Mercury Bank',kind='company',description='Banking services',domain='mercury.com',confidence=.6),Candidate(name='Mercury Marine',kind='company',description='Marine engines',domain='mercurymarine.com',confidence=.5)])
    monkeypatch.setattr(pipeline.search,'search',search)
    monkeypatch.setattr(pipeline.llm,'call',call)
    events=[]
    async def emit(event,data):events.append((event,data))
    result=await pipeline.build_brief(BriefRequest(subject='Mercury',meeting_at=datetime(2026,11,15,tzinfo=timezone.utc)),Run('prematch',emit))
    assert result['clarify'] is True
    assert [e[0] for e in events]==['run.started','entity.candidates','clarify.needed','run.completed']
    assert events[-1][1]['needs_clarification'] is True


@pytest.mark.asyncio
async def test_research_keeps_verified_sections_and_filters_streamed_citations(monkeypatch):
    from datetime import date
    from unittest.mock import AsyncMock
    from backend.core.models import Plan,Section,Findings,Finding,Support,Brief,Window,Item
    meeting=datetime(2026,11,14,tzinfo=timezone.utc)
    entity=Candidate(name='Example',kind='company',description='Company',domain='example.com',confidence=1)
    observed=[]
    saved=AsyncMock()
    async def search(query,*args,**kwargs):
        if query=='unavailable':raise RuntimeError('Source unavailable')
        return [{'url':'https://example.com/news','title':'Product launch','content':'Example launched a product.','published_date':'2026-11-10','score':1}]
    async def call(run,agent,system,content,schema=None,on_partial=None,**kwargs):
        if agent=='Assist':return Plan(sections=[Section(name='News',queries=['news']),Section(name='People',queries=['unavailable'])])
        if agent=='Overlap':
            if content['section']=='People':raise RuntimeError('Section could not be checked')
            sid=content['sources'][0]['id']
            return Findings(findings=[Finding(id='new',section='News',title='Product launch',date=date(2026,11,10),summary='A product launched.',source_ids=[sid])])
        if agent=='VAR':return Support(supported_ids=[f['id'] for f in content['findings']])
        if agent=='Golazo':
            sid=content['findings'][0]['source_ids'][0]
            snapshot={'headline':[{'text':'Good item','source_ids':[sid]},{'text':'Bad citation','source_ids':['invented']},{'text':'Incomplete'}]}
            await on_partial(snapshot)
            await on_partial(snapshot)
            return Brief(subject='Example',kind='company',meeting_at=meeting,window=Window(start=date(2026,10,15),end=date(2026,11,14)),headline=[Item(text='Good item',source_ids=[sid]),Item(text='Bad citation',source_ids=['invented'])])
        raise AssertionError(agent)
    monkeypatch.setattr(pipeline.search,'search',search)
    monkeypatch.setattr(pipeline.search,'extract',AsyncMock(return_value={}))
    monkeypatch.setattr(pipeline.llm,'call',call)
    monkeypatch.setattr(pipeline.store,'set',saved)
    async def emit(event,data):observed.append((event,data))
    result=await pipeline.build_brief(BriefRequest(subject='Example',meeting_at=meeting,entity=entity),Run('prematch',emit))
    brief=result['brief']
    assert len(brief.headline)==1
    assert len(brief.sources)==1
    assert brief.headline[0].source_ids==[brief.sources[0].id]
    partials=[data for event,data in observed if event=='brief.section' and data['name']=='headline']
    assert len(partials)==2, 'One deduplicated partial snapshot and one final section'
    assert len(partials[0]['content'])==1
    failures=[data for event,data in observed if event=='section.findings' and data['section']=='People']
    assert failures[0]['findings']==[]
    assert observed[-1][0]=='run.completed'
    saved.assert_awaited_once()


@pytest.mark.asyncio
async def test_brief_items_citing_finding_ids_keep_their_sources(monkeypatch):
    from datetime import date
    from unittest.mock import AsyncMock
    from backend.core.models import Plan,Section,Findings,Finding,Support,Brief,Window,Item
    meeting=datetime(2026,11,14,tzinfo=timezone.utc)
    entity=Candidate(name='Example',kind='company',description='Company',domain='example.com',confidence=1)
    observed=[]
    async def search(query,*args,**kwargs):
        return [{'url':'https://example.com/news','title':'Product launch','content':'Example launched a product.','published_date':'2026-11-10','score':1}]
    async def call(run,agent,system,content,schema=None,on_partial=None,**kwargs):
        if agent=='Assist':return Plan(sections=[Section(name='News',queries=['news'])])
        if agent=='Overlap':
            sid=content['sources'][0]['id']
            return Findings(findings=[Finding(id='new',section='News',title='Product launch',date=date(2026,11,10),summary='A product launched.',source_ids=[sid])])
        if agent=='VAR':return Support(supported_ids=[f['id'] for f in content['findings']])
        if agent=='Golazo':
            fid=content['findings'][0]['id']
            await on_partial({'headline':[{'text':'Cites a finding','source_ids':[fid]}]})
            return Brief(subject='Example',kind='company',meeting_at=meeting,window=Window(start=date(2026,10,15),end=date(2026,11,14)),headline=[Item(text='Cites a finding',source_ids=[fid])])
        raise AssertionError(agent)
    monkeypatch.setattr(pipeline.search,'search',search)
    monkeypatch.setattr(pipeline.search,'extract',AsyncMock(return_value={}))
    monkeypatch.setattr(pipeline.llm,'call',call)
    monkeypatch.setattr(pipeline.store,'set',AsyncMock())
    async def emit(event,data):observed.append((event,data))
    result=await pipeline.build_brief(BriefRequest(subject='Example',meeting_at=meeting,entity=entity),Run('prematch',emit))
    brief=result['brief']
    assert [item.text for item in brief.headline]==['Cites a finding']
    assert brief.headline[0].source_ids==[brief.sources[0].id]
    partials=[data for event,data in observed if event=='brief.section' and data['name']=='headline']
    assert partials[0]['content'][0]['source_ids']==[brief.sources[0].id]
