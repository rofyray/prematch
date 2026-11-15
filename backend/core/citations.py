import re
from rapidfuzz.fuzz import partial_ratio
from .models import Verdict, Source, Brief, Correction

def normalize(text):
    return ' '.join(text.casefold().split())

def validate_quotes(verdict: Verdict, sources: list[Source]) -> Verdict:
    known = {s.id:s for s in sources}
    verdict.quotes = [q for q in verdict.quotes if q.source_id in known and len(q.text.strip()) >= 12 and partial_ratio(normalize(q.text),normalize(known[q.source_id].snippet)) >= 90]
    verdict.supporting_source_ids = [sid for sid in verdict.supporting_source_ids if sid in {q.source_id for q in verdict.quotes}]
    if not verdict.quotes and verdict.label != 'unverifiable':
        verdict.confidence *= .5
        verdict.note += ' No supporting quotation could be matched to the source text.'
        # An unsupported verdict must not be presented as settled evidence.
        verdict.label = 'unverifiable'
        verdict.current_value = None
    return verdict

def validate_correction(correction: Correction, sources: list[Source]):
    known = {s.id for s in sources}
    citations = {c.n:c.source_id for c in correction.citations}
    references = {int(n) for n in re.findall(r'\[(\d+)\]',correction.text)}
    if len(citations) != len(correction.citations) or any(sid not in known for sid in citations.values()) or not references.issubset(citations):
        raise ValueError('The corrected answer contains an invalid citation.')
    return correction

def clean_brief(brief: Brief, sources: list[Source]):
    known = {s.id for s in sources}
    for field in ('headline','numbers','what_changed','who_to_know','talking_points','questions','avoid'):
        items = getattr(brief,field)
        setattr(brief,field,[item for item in items if item.source_ids and set(item.source_ids).issubset(known)])
    brief.sources = sources
    return brief
