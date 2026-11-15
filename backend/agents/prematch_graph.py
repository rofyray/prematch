import asyncio
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from backend.core import llm, search
from backend.core.cache import store
from backend.core.models import Candidates, Plan, Findings, Support, Brief
from backend.core.findings import research_window, clean_findings
from backend.core.rerank import rerank
from backend.core.citations import clean_brief

class State(TypedDict, total=False):
    request: object
    run: object
    entity: object
    candidates: list
    window: object
    plan: object
    findings: list
    sources: list
    brief: object
    clarify: bool

async def resolve(state):
    req,run = state['request'],state['run']
    window = research_window(req.meeting_at)
    if req.entity:
        return {'entity':req.entity,'window':window,'clarify':False}
    results = await search.search(req.subject,run)
    candidates = await llm.call(run,'Cruyff','Resolve the requested company or person using search results. If ambiguous, list distinct likely candidates. Use only real entities in sources. Give confidence for each and the official domain when known. Sort most likely first.',
                                {'subject':req.subject,'type':req.subject_type,'sources':results},Candidates)
    await run.emit('entity.candidates',candidates=candidates.candidates)
    if not candidates.candidates:
        raise ValueError('Entity could not be resolved.')
    if candidates.candidates[0].confidence < .75 and len(candidates.candidates) >= 2:
        await run.emit('clarify.needed',candidates=candidates.candidates)
        await run.emit('run.completed',needs_clarification=True)
        return {'clarify':True}
    return {'entity':candidates.candidates[0],'window':window,'clarify':False}

async def plan(state):
    req,run = state['request'],state['run']
    result = await llm.call(run,'Assist','Plan research sections and one or two search queries each. For companies cover news, launches, people, financials, partnerships, regulation. For people cover role changes, publications, appearances, mentions and company news. Tailor queries to the meeting purpose.',
                            {'entity':state['entity'].model_dump(),'window':state['window'].model_dump(mode='json'),'purpose':req.purpose,'context':req.my_context},Plan)
    await run.emit('plan.ready',window=state['window'],sections=result.sections)
    return {'plan':result}

async def investigate(state):
    req,run,entity,window = state['request'],state['run'],state['entity'],state['window']
    async def research_section(section,index):
        try:
            results = await asyncio.gather(*(search.search(q,run,topic='news',start_date=str(window.start),end_date=str(window.end),filter_by_published_date=True,max_results=6) for q in section.queries),return_exceptions=True)
            sources = rerank([r for rows in results if isinstance(rows,list) for r in rows],[entity.domain] if entity.domain else [],prefix=f's{index}_')
            return section,sources
        except Exception:
            return section,[]
    groups = await asyncio.gather(*(research_section(s,i) for i,s in enumerate(state['plan'].sections)))
    try:
        newsroom = await search.search(f'{entity.name} newsroom updates',run,include_domains=[entity.domain],start_date=str(window.start),end_date=str(window.end),filter_by_published_date=True) if entity.domain else []
        primary = rerank(newsroom,[entity.domain] if entity.domain else [],prefix='primary_')
        extracted = await search.extract([str(s.url) for s in primary]+[str(s.url) for _,sources in groups for s in sources if s.official][:6],run)
    except Exception:
        primary,extracted = [],{}
    all_sources = {s.id:s for _,sources in groups for s in sources}
    all_sources.update({s.id:s for s in primary})
    for source in all_sources.values():
        source.snippet = extracted.get(str(source.url)) or source.snippet
    async def overlap(section,sources,index):
        try:
            sources = sources+primary[:2]
            if not sources:
                raise ValueError('No sources')
            findings = await llm.call(run,'Overlap','Extract relevant dated findings only from supplied evidence within the date window. Each must include source IDs, date, title, summary, named people and relevant numbers. Do not infer publication dates. Skip unsupported claims.',
                                      {'section':section.name,'entity':entity.model_dump(),'window':window.model_dump(mode='json'),'sources':[s.model_dump(mode='json') for s in sources]},Findings)
            for i,finding in enumerate(findings.findings):
                finding.id = f'f{index}_{i}'
                finding.section = section.name
            cleaned = clean_findings(findings.findings,sources,window)
            await run.emit('section.findings',section=section.name,findings=cleaned)
            return cleaned
        except Exception:
            await run.emit('section.findings',section=section.name,findings=[],reason='Nothing found. This section could not be verified.')
            return []
    results = await asyncio.gather(*(overlap(s,sources,i) for i,(s,sources) in enumerate(groups)))
    sources = list(all_sources.values())
    canonical,aliases = {},{}
    for source in sources:
        url = str(source.url)
        if url in canonical:
            aliases[source.id] = canonical[url].id
        else:
            canonical[url] = source
    sources = list(canonical.values())
    for group in results:
        for finding in group:
            finding.source_ids = list(dict.fromkeys(aliases.get(sid,sid) for sid in finding.source_ids))
    findings = clean_findings([f for group in results for f in group],sources,window)
    if not findings:
        raise ValueError('No supported findings in the date window.')
    support = await llm.call(run,'VAR','Check all findings against the provided source text. Return only IDs whose summaries, numbers and dates are directly supported. Exclude unsupported findings.',
                             {'findings':[f.model_dump(mode='json') for f in findings],'sources':[s.model_dump(mode='json') for s in sources]},Support)
    findings = [f for f in findings if f.id in support.supported_ids]
    if not findings:
        raise ValueError('The findings did not pass the source check.')
    await run.emit('findings.labeled',findings=findings)
    return {'findings':findings,'sources':sources}

async def synthesize(state):
    req,run,entity,window = state['request'],state['run'],state['entity'],state['window']
    brief = await llm.call(run,'Golazo','Write a concise one-page meeting brief using ONLY the supplied findings. Three headline bullets, up to four numbers, three talking points, and three to five source-backed questions. Every item must have source_ids from its findings. Unconfirmed findings belong only in avoid. Keep the entire brief under 550 words. Tailor questions to the meeting purpose and context. Preserve verified/reported status.',
                           {'entity':entity.model_dump(),'window':window.model_dump(mode='json'),'meeting_at':req.meeting_at,'with_person':req.with_person,'purpose':req.purpose,'my_context':req.my_context,'findings':[f.model_dump(mode='json') for f in state['findings']]},Brief)
    brief.subject,brief.kind = entity.name,entity.kind
    brief.meeting_at,brief.with_person,brief.window = req.meeting_at,req.with_person,window
    used = {sid for finding in state['findings'] for sid in finding.source_ids}
    brief = clean_brief(brief,[source for source in state['sources'] if source.id in used])
    for name in ('headline','numbers','what_changed','who_to_know','talking_points','questions','avoid'):
        await run.emit('brief.section',name=name,content=getattr(brief,name))
    stored = {'brief_id':run.id,'brief':brief.model_dump(mode='json'),'findings':[f.model_dump(mode='json') for f in state['findings']], 'telemetry':run.finish().model_dump(mode='json')}
    await store.set('run:'+run.id,stored,604800)
    await run.emit('brief.ready',brief_id=run.id,brief=brief)
    await run.emit('run.telemetry',telemetry=run.telemetry)
    await run.emit('run.completed',brief_id=run.id)
    return {'brief':brief}

builder = StateGraph(State)
for name,node in [('Cruyff',resolve),('Assist',plan),('parallel_Overlap',investigate),('Golazo',synthesize)]:
    builder.add_node(name,node)
builder.add_edge(START,'Cruyff')
builder.add_conditional_edges('Cruyff',lambda s:END if s.get('clarify') else 'Assist')
builder.add_edge('Assist','parallel_Overlap')
builder.add_edge('parallel_Overlap','Golazo')
builder.add_edge('Golazo',END)
graph = builder.compile()

async def build_brief(request,run):
    run.telemetry.tavily.live = False
    await run.emit('run.started')
    return await graph.ainvoke({'request':request,'run':run})
