import asyncio
import json
from uuid import uuid4
from fastapi.encoders import jsonable_encoder
from .config import SetupError


def encode(event, data):
    return f'event: {event}\ndata: {json.dumps(jsonable_encoder(data),ensure_ascii=False)}\n\n'

async def stream(factory, timeout=280):
    queue = asyncio.Queue()
    envelope = {"run_id":str(uuid4()),"t_ms":0}
    async def emit(event,data):
        envelope.update({k:data[k] for k in ("run_id","t_ms") if k in data})
        await queue.put((event,{**envelope,**data}))
    async def execute():
        try:
            async with asyncio.timeout(timeout):
                await factory(emit)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            await emit('run.error',{'code':'setup_required' if isinstance(error,SetupError) else 'run_failed',
                                  'message':'Live research is not configured yet. Please try again after setup.' if isinstance(error,SetupError) else 'Research could not finish. Please try again.',
                                  'retryable':not isinstance(error,SetupError)})
        finally:
            await queue.put(None)
    task = asyncio.create_task(execute())
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(),10)
            except asyncio.TimeoutError:
                yield ': ping\n\n'
                continue
            if item is None:
                break
            yield encode(*item)
    finally:
        task.cancel()
        await asyncio.gather(task,return_exceptions=True)
