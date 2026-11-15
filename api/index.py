import os
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from backend.core.http import health, guard, get_run, events
from backend.core.models import BriefRequest
from backend.core.telemetry import Run
from backend.core.config import required, SetupError
from backend.core.cache import store
from backend.agents.prematch_graph import build_brief

app = FastAPI(title='PreMatch API',docs_url='/api/py/docs',openapi_url='/api/py/openapi.json')
app.get('/api/py/health')(health)
app.get('/api/py/runs/{run_id}')(get_run)

@app.post('/api/py/brief')
async def brief_route(body: BriefRequest, request: Request):
    await guard(request,'prematch')
    async def execute(emit):
        await build_brief(body,Run('prematch',emit))
    return events(execute)

def brief_text(data):
    brief = data['brief']
    lines = [brief['subject'],f"Meeting: {brief['meeting_at']}",f"Research window: {brief['window']['start']} to {brief['window']['end']}"]
    for field in ('headline','numbers','what_changed','who_to_know','talking_points','questions','avoid'):
        lines.append('\n'+field.replace('_',' ').title())
        for item in brief.get(field,[]):
            text = item.get('text') or f"{item['value']}: {item['label']}"
            lines.append(f"- {text} [{', '.join(item['source_ids'])}]")
    lines.append('\nSources')
    lines.extend(f"{s['id']}: {s['title']} {s['url']}" for s in brief['sources'])
    return '\n'.join(lines)

@app.get('/api/py/brief/{run_id}/text',response_class=PlainTextResponse)
async def text_route(run_id: str):
    return brief_text(await get_run(run_id))

class VoiceRequest(BaseModel):
    brief_id: str

@app.post('/api/py/voice/session')
async def voice_session(body: VoiceRequest, request: Request):
    data = await get_run(body.brief_id)
    identity = request.headers.get('x-vercel-forwarded-for','').split(',')[0] if os.getenv('VERCEL') else (request.client.host if request.client else 'local')
    if not await store.allow(identity or 'unknown','prematch-voice'):
        raise HTTPException(429,'Please wait before starting another voice session.')
    try:
        key = required('OMNIDIM_API_KEY')
        agent = int(required('OMNIDIM_AGENT_ID'))
    except (SetupError,ValueError):
        raise HTTPException(503,'Voice coaching is not configured yet. You can still read and download your brief.')
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post('https://omnidim.io/api/v1/sessions/create',headers={'Authorization':f'Bearer {key}'},
                json={'agent_id':agent,'type':'voice','custom_variables':{'brief_id':body.brief_id,'brief_context':brief_text(data)}})
            response.raise_for_status()
            url = response.json()['ws_url']
            if not url.startswith('wss://'):
                raise ValueError('Invalid voice connection')
            return {'connection_url':url}
    except Exception:
        raise HTTPException(502,'The voice session could not start. Please try again.')
