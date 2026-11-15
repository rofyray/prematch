import math
from collections import Counter
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from .models import Source

REPUTABLE = {'reuters.com','apnews.com','bbc.com','bbc.co.uk','ft.com','bloomberg.com','techcrunch.com','theverge.com','wsj.com','nytimes.com','businesswire.com','prnewswire.com'}
UNCONFIRMED = {'reddit.com','x.com','twitter.com','facebook.com','linkedin.com','quora.com','medium.com','news.ycombinator.com'}

def matches(domain: str, domains) -> bool:
    return any(domain == d or domain.endswith('.' + d) for d in domains if d)

def authority(source: Source) -> float:
    if source.official:
        return 1.0
    return 0.7 if matches(source.domain, REPUTABLE) else 0.4

def recency(source: Source, today: date | None = None) -> float:
    return math.exp(-max(0,((today or date.today()) - source.published_date).days)/180) if source.published_date else 0.3

def publication_date(value) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(text)
        except (ValueError, TypeError, OverflowError):
            return None
    return parsed.astimezone(timezone.utc).date() if parsed.tzinfo else parsed.date()

def rerank(results: list[dict], preferred: list[str], today: date | None = None, prefix='s') -> list[Source]:
    candidates = []
    seen = set()
    for result in results:
        url = result.get('url','')
        parsed = urlparse(url)
        if parsed.scheme not in ('http','https') or not parsed.hostname or url in seen:
            continue
        seen.add(url)
        domain = parsed.hostname.removeprefix('www.')
        published = publication_date(result.get('published_date'))
        source = Source(id=prefix + str(len(candidates)+1),url=url,domain=domain,title=result.get('title') or domain,
                        published_date=published,snippet=(result.get('raw_content') or result.get('content') or '')[:12000],
                        official=matches(domain,preferred) or domain.endswith('.gov'))
        source.score = .55 * max(0,min(1,float(result.get('score',0)))) + .25 * recency(source,today) + .2 * authority(source)
        candidates.append(source)
    counts = Counter()
    selected = []
    for source in sorted(candidates,key=lambda x:x.score,reverse=True):
        if counts[source.domain] < 2:
            selected.append(source)
            counts[source.domain] += 1
        if len(selected) == 4:
            break
    return selected
