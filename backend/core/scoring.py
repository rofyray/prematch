from datetime import date, timedelta
from .models import Claim, Verdict, Source
from .rerank import authority, recency

VOLATILITY = {'pricing':30,'api_version':45,'leadership':90,'law_regulation':180,'statistic':180,'product':60,'event':365,'other':120}

def repair_claims(answer: str, claims: list[Claim]):
    repaired = []
    occupied = []
    for claim in claims[:8]:
        start,end = claim.span
        if start < 0 or end <= start or answer[start:end] != claim.text:
            start = answer.find(claim.text)
            end = start + len(claim.text)
        if start < 0 or not claim.text or any(start < b and end > a for a,b in occupied):
            continue
        claim.span = (start,end)
        claim.id = f'c{len(repaired)+1}'
        claim.volatility_days = VOLATILITY[claim.category]
        occupied.append((start,end))
        repaired.append(claim)
    return repaired

def score(verdict: Verdict, claim: Claim, sources: list[Source], today: date | None = None):
    today = today or date.today()
    verdict.recheck_by = today + timedelta(days=claim.volatility_days)
    if verdict.label == 'unverifiable' or not sources:
        verdict.freshness = None
        return verdict
    best = max(sources,key=lambda s:s.score)
    agreement = len(set(verdict.supporting_source_ids) & {s.id for s in sources}) / len(sources)
    confidence = max(0,min(1,.5*verdict.confidence + .2*authority(best) + .15*agreement + .15*recency(best,today)))
    value = {'current':1,'partially_current':.5,'outdated':0,'contradicted':0}[verdict.label]
    verdict.freshness = round(50+(value-.5)*100*confidence)
    return verdict

def label(verdict: Verdict):
    if verdict.label in ('outdated','contradicted'):
        return 'offside'
    if verdict.label == 'unverifiable':
        return 'no_call'
    if verdict.label == 'partially_current' or (verdict.freshness or 0) < 70:
        return 'tight'
    return 'onside'
