from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, HttpUrl, field_validator

class Source(BaseModel):
    id: str
    url: HttpUrl
    domain: str
    title: str
    published_date: date | None = None
    snippet: str = ''
    official: bool = False
    score: float = 0

Category = Literal['pricing','api_version','leadership','law_regulation','statistic','product','event','other']
class Claim(BaseModel):
    id: str
    text: str
    span: tuple[int, int]
    category: Category = 'other'
    volatility_days: int = 120
    stated_value: str = ''
    queries: list[str] = Field(default_factory=list, max_length=2)
    preferred_domains: list[str] = Field(default_factory=list)

class Claims(BaseModel):
    claims: list[Claim] = Field(default_factory=list, max_length=8)

class Quote(BaseModel):
    source_id: str
    text: str

class Verdict(BaseModel):
    label: Literal['current','partially_current','outdated','contradicted','unverifiable']
    current_value: str | None = None
    quotes: list[Quote] = Field(default_factory=list)
    confidence: float = Field(default=0, ge=0, le=1)
    supporting_source_ids: list[str] = Field(default_factory=list)
    conflict: bool = False
    freshness: int | None = None
    recheck_by: date | None = None
    decided_by: Literal['VAR','Panenka'] = 'VAR'
    model: str = ''
    note: str = ''

class Citation(BaseModel):
    n: int = Field(ge=1)
    source_id: str

class Correction(BaseModel):
    text: str
    citations: list[Citation] = Field(default_factory=list)

class CallRecord(BaseModel):
    agent: str
    model_requested: str
    model_served: str
    effort: str
    latency_ms: int
    input_tokens: int = 0
    output_tokens: int = 0
    cache_hit: bool = False
    fallback_used: bool = False
    bifrost_request_id: str | None = None
    cost_usd: float | None = None

class TavilyUsage(BaseModel):
    credits: float = 0
    searches: int = 0
    extracts: int = 0
    cache_hits: int = 0
    live: bool = True

class BifrostUsage(BaseModel):
    calls: int = 0
    cache_hits: int = 0
    fallbacks: int = 0

class Telemetry(BaseModel):
    total_ms: int = 0
    calls: list[CallRecord] = Field(default_factory=list)
    tavily: TavilyUsage = Field(default_factory=TavilyUsage)
    bifrost: BifrostUsage = Field(default_factory=BifrostUsage)

class CheckedClaim(Claim):
    verdict: Verdict
    sources: list[Source] = Field(default_factory=list)

class CheckResult(BaseModel):
    run_id: str
    answer: str
    freshness: int | None
    counts: dict[str,int]
    claims: list[CheckedClaim]
    corrected: Correction
    telemetry: Telemetry

class Candidate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kind: Literal['company','person']
    description: str = Field(max_length=1000)
    domain: str | None = None
    confidence: float = Field(ge=0, le=1)

class Candidates(BaseModel):
    candidates: list[Candidate] = Field(max_length=5)

class Section(BaseModel):
    name: str
    queries: list[str] = Field(min_length=1, max_length=2)

class Plan(BaseModel):
    sections: list[Section] = Field(min_length=1, max_length=6)

class Number(BaseModel):
    value: str
    label: str

class Finding(BaseModel):
    id: str
    section: str
    title: str
    date: date
    summary: str
    source_ids: list[str]
    people: list[str] = Field(default_factory=list)
    numbers: list[Number] = Field(default_factory=list)
    status: Literal['verified','reported','unconfirmed'] = 'unconfirmed'

class Findings(BaseModel):
    findings: list[Finding] = Field(default_factory=list, max_length=6)

class Support(BaseModel):
    supported_ids: list[str]

class Item(BaseModel):
    text: str = Field(max_length=420)
    source_ids: list[str]
    status: Literal['verified','reported','unconfirmed'] | None = None

class BriefNumber(Number):
    status: Literal['verified','reported','unconfirmed']
    source_ids: list[str]

class Window(BaseModel):
    start: date
    end: date

class Brief(BaseModel):
    subject: str
    kind: Literal['company','person']
    meeting_at: datetime
    with_person: str | None = None
    window: Window
    headline: list[Item] = Field(default_factory=list, max_length=3)
    numbers: list[BriefNumber] = Field(default_factory=list, max_length=4)
    what_changed: list[Item] = Field(default_factory=list, max_length=5)
    who_to_know: list[Item] = Field(default_factory=list, max_length=4)
    talking_points: list[Item] = Field(default_factory=list, max_length=3)
    questions: list[Item] = Field(default_factory=list, max_length=5)
    avoid: list[Item] = Field(default_factory=list, max_length=3)
    sources: list[Source] = Field(default_factory=list)

class CheckRequest(BaseModel):
    answer: str = Field(min_length=20, max_length=6000)
    question: str | None = Field(default=None, max_length=1000)
    prefer_official: bool = True
    live: bool = True

class AskRequest(BaseModel):
    question: str = Field(min_length=5, max_length=2000)
    models: list[str] = Field(min_length=1, max_length=3)

class BriefRequest(BaseModel):
    subject: str = Field(min_length=2, max_length=200)
    subject_type: Literal['auto','company','person'] = 'auto'
    meeting_at: datetime
    purpose: Literal['partnership','sales','investor','hiring','other'] = 'partnership'
    with_person: str | None = Field(default=None, max_length=200)
    my_context: str | None = Field(default=None, max_length=2000)
    entity: Candidate | None = None

    @field_validator('meeting_at')
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError('Include a time zone for your meeting.')
        return value

    @field_validator('subject')
    @classmethod
    def not_blank(cls, value):
        if len(value.strip()) < 2:
            raise ValueError('Enter a company or person.')
        return value.strip()
