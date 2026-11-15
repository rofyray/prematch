import { it, expect } from "vitest";
import { initial, reduceBrief } from "./reducer";
it("preserves clarification through terminal event", () => {
  let state = reduceBrief(initial, {
    type: "clarify.needed",
    data: { candidates: [{ name: "Acme" }] },
  });
  state = reduceBrief(state, {
    type: "run.completed",
    data: { needs_clarification: true },
  });
  expect(state.status).toBe("clarify");
  expect(state.candidates[0].name).toBe("Acme");
});
it("replaces section findings when evidence is updated", () => {
  let state = reduceBrief(initial, {
    type: "section.findings",
    data: { section: "news", findings: [{ id: "old", section: "news" }] },
  });
  state = reduceBrief(state, {
    type: "section.findings",
    data: { section: "news", findings: [{ id: "new", section: "news" }] },
  });
  expect(state.findings.map((f) => f.id)).toEqual(["new"]);
});
it("clears the old brief on reset", () =>
  expect(
    reduceBrief({ ...initial, error: "old" }, { type: "reset", data: {} }),
  ).toEqual({ ...initial, status: "running" }));
