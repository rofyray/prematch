import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import BaseModel
from backend.core import llm, search
from backend.core.telemetry import Run


@pytest.mark.asyncio
async def test_parallel_extractions_share_each_url_and_keep_batches(monkeypatch):
    monkeypatch.setattr(search.store, 'get', AsyncMock(return_value=None))
    monkeypatch.setattr(search.store, 'set', AsyncMock())
    requested = []
    async def request(path, body, run):
        requested.append(body['urls'])
        await asyncio.sleep(0)
        return {'results':[{'url':url,'raw_content':'source '+url} for url in body['urls']]}
    monkeypatch.setattr(search, 'request', request)
    run = Run('offside', AsyncMock())
    first, second = await asyncio.gather(search.extract(['a','b'],run),search.extract(['b','c'],run))
    assert first == {'a':'source a','b':'source b'}
    assert second == {'b':'source b','c':'source c'}
    assert requested == [['a','b'],['c']]
    assert await search.extract(['b'],run) == {'b':'source b'}
    assert len(requested) == 2
    assert await search.extract([],run) == {}


@pytest.mark.asyncio
@pytest.mark.parametrize('valid_second', [True,False])
async def test_model_schema_retry_is_bounded_and_always_closes_client(monkeypatch, valid_second):
    class Result(BaseModel):
        value: int
    monkeypatch.setenv('BIFROST_URL','https://gateway.example')
    monkeypatch.setenv('BIFROST_VK','test-key')
    attempts=[]
    close=AsyncMock()
    async def create(**kwargs):
        attempts.append(kwargs)
        payload={'value':3} if valid_second and len(attempts)==2 else {'value':'invalid'}
        response=SimpleNamespace(model='claude-haiku-5-5',usage=SimpleNamespace(input_tokens=1,output_tokens=1),content=[SimpleNamespace(type='tool_use',name='result',input=payload)])
        return SimpleNamespace(headers={},parse=AsyncMock(return_value=response))
    monkeypatch.setattr(llm.anthropic,'AsyncAnthropic',lambda **kw:SimpleNamespace(messages=SimpleNamespace(with_raw_response=SimpleNamespace(create=create)),close=close))
    run=Run('offside',AsyncMock())
    if valid_second:
        assert (await llm.call(run,'Stepover','Extract.',{},Result)).value==3
    else:
        with pytest.raises(ValueError,match='invalid result'):
            await llm.call(run,'Stepover','Extract.',{},Result)
    assert len(attempts)==2
    assert run.telemetry.bifrost.calls==2
    close.assert_awaited_once()
