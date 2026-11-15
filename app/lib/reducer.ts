import type {
  Brief,
  Candidate,
  Finding,
  StreamEvent,
  Telemetry,
} from "./types";
export type BriefState = {
  status: string;
  runId?: string;
  candidates: Candidate[];
  findings: Finding[];
  sections: Record<string, string>;
  partial: Record<string, { text?: string; value?: string; label?: string }[]>;
  brief?: Brief;
  telemetry?: Telemetry;
  error?: string;
  window?: { start: string; end: string };
};
export const initial: BriefState = {
  status: "idle",
  candidates: [],
  findings: [],
  sections: {},
  partial: {},
};
export function reduceBrief(state: BriefState, event: StreamEvent): BriefState {
  const d = event.data;
  switch (event.type) {
    case "reset":
      return { ...initial, status: "running" };
    case "run.started":
      return { ...state, status: "running", runId: d.run_id as string };
    case "clarify.needed":
      return {
        ...state,
        status: "clarify",
        candidates: d.candidates as Candidate[],
      };
    case "plan.ready":
      return {
        ...state,
        window: d.window as BriefState["window"],
        sections: Object.fromEntries(
          (d.sections as { name: string }[]).map((s) => [
            s.name,
            "Researching",
          ]),
        ),
      };
    case "section.findings":
      return {
        ...state,
        findings: [
          ...state.findings.filter((f) => f.section !== d.section),
          ...(d.findings as Finding[]),
        ],
        sections: {
          ...state.sections,
          [d.section as string]: (d.findings as Finding[]).length
            ? `${(d.findings as Finding[]).length} findings`
            : (d.reason as string) || "Nothing found",
        },
      };
    case "findings.labeled":
      return { ...state, findings: d.findings as Finding[] };
    case "brief.section":
      return {
        ...state,
        partial: {
          ...state.partial,
          [d.name as string]: d.content as BriefState["partial"][string],
        },
      };
    case "brief.ready":
      return { ...state, brief: d.brief as Brief, runId: d.brief_id as string };
    case "run.telemetry":
      return { ...state, telemetry: d.telemetry as Telemetry };
    case "run.completed":
      return {
        ...state,
        status: d.needs_clarification ? "clarify" : "complete",
      };
    case "run.error":
      return { ...state, status: "error", error: d.message as string };
    default:
      return state;
  }
}
