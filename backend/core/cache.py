import asyncio
import hashlib
import json
import os
import time
import httpx
from datetime import datetime, timezone
from redis.asyncio import Redis
from .config import SetupError


def cache_key(query: str, params: dict, bucket: str | None = None) -> str:
    normalized = ' '.join(query.lower().split())
    bucket = bucket or datetime.now(timezone.utc).date().isoformat()
    return 'tv:s:' + hashlib.sha256(json.dumps([normalized, params, bucket], sort_keys=True).encode()).hexdigest()


class Store:
    def __init__(self):
        self.memory = {}
        self.lock = asyncio.Lock()
        self._redis = None
        self._url = None

    @property
    def redis(self):
        url = os.getenv('REDIS_URL')
        if url and url != self._url:
            self._redis = Redis.from_url(url, decode_responses=True, socket_timeout=5)
            self._url = url
        return self._redis if url else None

    async def remote(self, operation, **values):
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(os.environ["STORAGE_URL"].rstrip("/")+"/command",
                headers={"Authorization":"Bearer "+os.environ["STORAGE_TOKEN"]},json={"operation":operation,**values})
            response.raise_for_status()
            return response.json()["result"]

    async def ping(self):
        if os.getenv("STORAGE_URL"):
            return await self.remote("ping")
        return bool(await self.redis.ping()) if self.redis else False

    def ensure_local(self):
        if os.getenv('VERCEL') and not self.redis and not os.getenv('STORAGE_URL'):
            raise SetupError('Persistent storage is not configured.')

    async def get(self, key):
        if os.getenv("STORAGE_URL"):
            return await self.remote("get",key=key)
        if self.redis:
            raw = await self.redis.get(key)
            return json.loads(raw) if raw else None
        self.ensure_local()
        entry = self.memory.get(key)
        if entry and entry[0] > time.time():
            return entry[1]
        self.memory.pop(key, None)
        return None

    async def set(self, key, value, ttl):
        if os.getenv("STORAGE_URL"):
            return await self.remote("set",key=key,value=value,ttl=ttl)
        if self.redis:
            await self.redis.set(key, json.dumps(value), ex=ttl)
        else:
            self.ensure_local()
            self.memory[key] = (time.time() + ttl, value)

    async def allow(self, identity: str, app: str, now: float | None = None):
        if os.getenv("STORAGE_URL"):
            return await self.remote("allow",identity=identity,app=app)
        now = now or time.time()
        digest = hashlib.sha256(identity.encode()).hexdigest()[:24]
        keys = [f'limit:{app}:{digest}:{period}:{int(now // period)}' for period in (600,86400)]
        if self.redis:
            # Check and consume both windows atomically. Denied runs consume neither.
            script = """
            for i,key in ipairs(KEYS) do
              if tonumber(redis.call('GET',key) or '0') >= tonumber(ARGV[i]) then return 0 end
            end
            for i,key in ipairs(KEYS) do
              local n = redis.call('INCR',key)
              if n == 1 then redis.call('EXPIRE',key,ARGV[i+2]) end
            end
            return 1
            """
            return bool(await self.redis.eval(script,2,*keys,6,40,600,86400))
        self.ensure_local()
        async with self.lock:
            counts = [await self.get(k) or 0 for k in keys]
            if counts[0] >= 6 or counts[1] >= 40:
                return False
            for key,n,ttl in zip(keys,counts,(600,86400)):
                await self.set(key,n+1,ttl)
            return True

store = Store()
