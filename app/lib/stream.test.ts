import { describe, it, expect } from "vitest";
import { parseFrame, readEvents, safeUrl } from "./stream";
describe("SSE transport", () => {
  it("ignores heartbeat comments", () =>
    expect(parseFrame(": ping")).toBeNull());
  it("decodes event data", () =>
    expect(parseFrame('event: claim.verdict\ndata: {"claim_id":"c1"}')).toEqual(
      { type: "claim.verdict", data: { claim_id: "c1" } },
    ));
  it("handles chunked multibyte text", async () => {
    const bytes = new TextEncoder().encode(
      'event: run.completed\ndata: {"text":"café"}\n\n',
    );
    const response = new Response(
      new ReadableStream({
        start(c) {
          for (const b of bytes) c.enqueue(new Uint8Array([b]));
          c.close();
        },
      }),
    );
    const events: unknown[] = [];
    await readEvents(response, (e) => events.push(e));
    expect(events).toEqual([{ type: "run.completed", data: { text: "café" } }]);
  });
  it("accepts CRLF separators split across network chunks", async () => {
    const bytes = new TextEncoder().encode(
      'event: run.completed\r\ndata: {"text":"café"}\r\n\r\n',
    );
    const response = new Response(
      new ReadableStream({
        start(controller) {
          for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
          controller.close();
        },
      }),
    );
    const events: unknown[] = [];
    await readEvents(response, (event) => events.push(event));
    expect(events).toEqual([{ type: "run.completed", data: { text: "café" } }]);
  });
  it("rejects truncated streams", async () => {
    await expect(
      readEvents(new Response("event: run.started\ndata: {}\n\n"), () => {}),
    ).rejects.toThrow("ended before");
  });
  it("rejects unsafe source URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("https://example.com")).toBe("https://example.com");
  });
});
