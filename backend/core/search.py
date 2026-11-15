import asyncio
import hashlib
import os
import httpx
from .cache import store, cache_key
from .config import required

_semaphore = asyncio.Semaphore(8)

async def request(path, body, run):
    headers = {'Content-Type':'application/json'}
    if os.getenv('TAVILY_KEYLESS') == '1' and not os.getenv('VERCEL'):
        headers['X-Tavily-Access-Mode'] = 'keyless'
    else:
        headers['Authorization'] = f'Bearer {required("TAVILY_API_KEY")}'
    async with _semaphore, httpx.AsyncClient(timeout=35) as client:
        response = await client.post(f'https://api.tavily.com/{path}',json=body,headers=headers)
        response.raise_for_status()
        data = response.json()
    run.telemetry.tavily.credits += (data.get('usage') or {}).get('credits',0)
    return data

async def search(query,run,live=False,**params):
    defaults = {'search_depth':'basic','max_results':5,'chunks_per_source':3,'include_published_date':True,'include_usage':True,**params}
    if live:
        defaults['max_age_hours'] = 0
    key = cache_key(query,defaults)
    if key in run.search_tasks:
        run.telemetry.tavily.cache_hits += 1
        return await run.search_tasks[key]
    async def fetch():
        if not live:
            cached = await store.get(key)
            if cached is not None:
                run.telemetry.tavily.cache_hits += 1
                return cached
        run.telemetry.tavily.searches += 1
        data = await request('search',{'query':query,**defaults},run)
        results = data.get('results',[])
        if not live:
            await store.set(key,results,21600 if defaults.get('topic') == 'news' else 86400)
        return results
    task = asyncio.create_task(fetch())
    run.search_tasks[key] = task
    return await task

async def _extract_batch(urls,run):
    urls = list(dict.fromkeys(urls))[:10]
    if not urls:
        return {}
    cached = {}
    missing = []
    for url in urls:
        key = 'tv:x:'+hashlib.sha256(url.encode()).hexdigest()
        value = await store.get(key)
        if value is None:
            missing.append(url)
        else:
            cached[url] = value
            run.telemetry.tavily.cache_hits += 1
    if missing:
        run.telemetry.tavily.extracts += 1
        data = await request('extract',{'urls':missing,'extract_depth':'basic','include_usage':True},run)
        for item in data.get('results',[]):
            url = item['url']
            cached[url] = item.get('raw_content','')[:18000]
            await store.set('tv:x:'+hashlib.sha256(url.encode()).hexdigest(),cached[url],43200)
    return cached


async def extract(urls, run):
    urls = list(dict.fromkeys(urls))[:10]
    missing = [url for url in urls if url not in run.extract_tasks]
    if missing:
        # Register before yielding so parallel claims share the same extraction work.
        task = asyncio.create_task(_extract_batch(missing, run))
        for url in missing:
            run.extract_tasks[url] = task
    tasks = list(dict.fromkeys(run.extract_tasks[url] for url in urls))
    batches = await asyncio.gather(*tasks)
    return {url: text for batch in batches for url, text in batch.items() if url in urls}
