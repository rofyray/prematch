export type Source = {
  id: string;
  url: string;
  domain: string;
  title: string;
  published_date: string | null;
  snippet: string;
  official: boolean;
  score: number;
};
export type Verdict = {
  label:
    | "current"
    | "partially_current"
    | "outdated"
    | "contradicted"
    | "unverifiable";
  current_value: string | null;
  quotes: { source_id: string; text: string }[];
  confidence: number;
  freshness: number | null;
  recheck_by: string | null;
  decided_by: string;
  model: string;
  note: string;
};
export type Claim = {
  id: string;
  text: string;
  span: [number, number];
  category: string;
  volatility_days: number;
  stated_value: string;
  queries: string[];
  preferred_domains: string[];
  verdict?: Verdict;
  sources?: Source[];
};
export type Telemetry = {
  total_ms: number;
  calls: {
    agent: string;
    model_requested: string;
    model_served: string;
    effort: string;
    latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    cache_hit: boolean;
    fallback_used: boolean;
    bifrost_request_id: string | null;
    cost_usd: number | null;
  }[];
  tavily: {
    credits: number;
    searches: number;
    extracts: number;
    cache_hits: number;
    live: boolean;
  };
  bifrost: { calls: number; cache_hits: number; fallbacks: number };
};
export type Correction = {
  text: string;
  citations: { n: number; source_id: string }[];
};
export type CheckResult = {
  run_id: string;
  answer: string;
  freshness: number | null;
  counts: Record<string, number>;
  claims: Claim[];
  corrected: Correction;
  telemetry: Telemetry;
};
export type Candidate = {
  name: string;
  kind: "company" | "person";
  domain: string | null;
  description: string;
  confidence: number;
};
export type Item = { text: string; source_ids: string[]; status?: string };
export type Finding = {
  id: string;
  section: string;
  title: string;
  date: string;
  summary: string;
  source_ids: string[];
  status: string;
};
export type Brief = {
  subject: string;
  kind: string;
  meeting_at: string;
  with_person?: string;
  window: { start: string; end: string };
  headline: Item[];
  numbers: {
    value: string;
    label: string;
    status: string;
    source_ids: string[];
  }[];
  what_changed: Item[];
  who_to_know: Item[];
  talking_points: Item[];
  questions: Item[];
  avoid: Item[];
  sources: Source[];
};
export type StreamEvent = { type: string; data: Record<string, unknown> };
export function verdictName(v?: Verdict) {
  if (!v) return "Reviewing";
  return v.label === "unverifiable"
    ? "No call"
    : v.label === "partially_current"
      ? "Tight call"
      : v.label === "current"
        ? v.freshness !== null && v.freshness >= 70
          ? "Onside"
          : "Tight call"
        : "Offside";
}
export function verdictClass(v?: Verdict) {
  return verdictName(v).toLowerCase().replaceAll(" ", "-");
}
