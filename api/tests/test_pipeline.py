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
