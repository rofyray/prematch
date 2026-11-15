import type { StreamEvent } from "./types";
export function parseFrame(frame: string): StreamEvent | null {
  let type = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return data.length ? { type, data: JSON.parse(data.join("\n")) } : null;
}
export async function readEvents(
  response: Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      typeof payload.detail === "string"
        ? payload.detail
        : response.status === 422
          ? "Check the fields and try again."
          : "The request failed. Please try again.",
    );
  }
  if (!response.body) throw new Error("The connection could not be opened.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += (
        done ? decoder.decode() : decoder.decode(value, { stream: true })
      ).replaceAll("\r\n", "\n");
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const event = parseFrame(frame);
        if (event) {
          onEvent(event);
          if (event.type === "run.completed" || event.type === "run.error")
            terminal = true;
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!terminal)
    throw new Error(
      "The connection ended before research finished. Please try again.",
    );
}
export async function postEvents(
  path: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
) {
  return readEvents(
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }),
    onEvent,
  );
}
export function safeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? url : "#";
  } catch {
    return "#";
  }
}
