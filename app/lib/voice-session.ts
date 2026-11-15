import type { WebSession } from "@omnidim-ai/client";

/** Own the connection lifetime, including navigation while fetch/import/start is pending. */
export async function connectVoice(
  briefId: string,
  signal: AbortSignal,
  configure: (session: WebSession) => void,
) {
  const response = await fetch("/api/py/voice/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief_id: briefId }),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.detail || "The voice session could not start.");
  if (signal.aborted) return;
  const { WebSession } = await import("@omnidim-ai/client");
  if (signal.aborted) return;
  const session = new WebSession();
  const stop = () => session.stop();
  signal.addEventListener("abort", stop, { once: true });
  configure(session);
  try {
    await session.start({ wsUrl: data.connection_url });
    if (signal.aborted) stop();
  } catch (error) {
    signal.removeEventListener("abort", stop);
    stop();
    throw error;
  }
}
