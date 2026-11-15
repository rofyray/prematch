from fastapi.testclient import TestClient
from api.index import app

client=TestClient(app)

def test_timezone_validation():
    assert client.post('/api/py/brief',json={'subject':'Acme','meeting_at':'2026-11-14T10:00:00'}).status_code==422

def test_setup_fails_readably(monkeypatch):
    monkeypatch.delenv('BIFROST_URL',raising=False)
    response=client.post('/api/py/brief',json={'subject':'Acme','meeting_at':'2026-11-14T10:00:00-08:00'})
    assert response.status_code==503

def test_unknown_run():
    assert client.get('/api/py/runs/not-a-uuid').status_code==404
    assert client.get('/api/py/brief/not-a-uuid/text').status_code==404

def test_voice_requires_existing_brief():
    assert client.post('/api/py/voice/session',json={'brief_id':'not-a-uuid'}).status_code==404
