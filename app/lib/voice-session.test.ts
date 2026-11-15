import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectVoice } from "./voice-session";
const sdk = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  created: vi.fn(),
}));
vi.mock("@omnidim-ai/client", () => ({
  WebSession: class {
    constructor() {
      sdk.created();
    }
    start = sdk.start;
    stop = sdk.stop;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  sdk.start.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe("voice connection lifetime", () => {
  it("does not open audio after the brief is closed during the request", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort();
        return Response.json({ connection_url: "wss://voice.example" });
      }),
    );
    await connectVoice("brief", controller.signal, vi.fn());
    expect(sdk.created).not.toHaveBeenCalled();
  });
  it("stops a live session on navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ connection_url: "wss://voice.example" }),
        ),
    );
    const controller = new AbortController();
    const configure = vi.fn();
    await connectVoice("brief", controller.signal, configure);
    expect(configure).toHaveBeenCalledOnce();
    expect(sdk.start).toHaveBeenCalledWith({ wsUrl: "wss://voice.example" });
    controller.abort();
    expect(sdk.stop).toHaveBeenCalledOnce();
  });
  it("closes a failed startup and reports the original error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ connection_url: "wss://voice.example" }),
        ),
    );
    sdk.start.mockRejectedValueOnce(new Error("Microphone denied"));
    const controller = new AbortController();
    await expect(
      connectVoice("brief", controller.signal, vi.fn()),
    ).rejects.toThrow("Microphone denied");
    expect(sdk.stop).toHaveBeenCalledOnce();
    controller.abort();
    expect(sdk.stop).toHaveBeenCalledOnce();
  });
});
