import os
from uuid import UUID
import httpx
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from .cache import store
from redis.exceptions import RedisError
from .config import require_services, SetupError
from .sse import stream

async def health():
    bifrost = False
    redis = False
    if os.getenv('BIFROST_URL'):
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                bifrost = (await client.get(os.environ['BIFROST_URL'].rstrip('/')+'/health')).is_success
        except Exception:
            pass
    if store.redis or os.getenv('STORAGE_URL'):
        try:
            redis = bool(await store.ping())
        except Exception:
            pass
    return {'ok':bifrost and redis,'bifrost':bifrost,'redis':redis}

async def guard(request: Request, app):
    try:
        require_services()
        # Trust Vercel's canonical proxy header only on the deployed platform.
        identity = request.headers.get('x-vercel-forwarded-for','').split(',')[0] if os.getenv('VERCEL') else (request.client.host if request.client else 'local')
        if not await store.allow(identity or 'unknown',app):
            raise HTTPException(429,'You have reached the research limit. Try again in ten minutes.',headers={'Retry-After':'600'})
    except SetupError:
        raise HTTPException(503,'Live research is not configured yet. Please try again after setup.')
    except (RedisError,httpx.HTTPError):
        raise HTTPException(503,'Saved research is temporarily unavailable. Please try again shortly.')

async def get_run(run_id):
    try:
        UUID(run_id)
    except ValueError:
        raise HTTPException(404,'This result could not be found.')
    result = await store.get('run:'+run_id)
    if result is None:
        raise HTTPException(404,'This result has expired or could not be found. Build a new one.')
    return result

def events(factory):
    return StreamingResponse(stream(factory),media_type='text/event-stream',headers={'Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'})
