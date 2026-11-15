import type { StreamEvent } from "./types";
export type Example = {
  id: string;
  title: string;
  recorded_at: string;
  input: Record<string, unknown>;
  events: StreamEvent[];
};
export async function replayExample(
  example: Example,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
) {
  const duration = Math.max(
    ...example.events.map((e) => Number(e.data.t_ms) || 0),
    1,
  );
  let previous = 0;
  for (const event of example.events) {
    if (signal.aborted) return;
    const at =
      ((Number(event.data.t_ms) || 0) / duration) * Math.min(duration, 8000);
    const delay = Math.max(0, at - previous);
    previous = at;
    if (delay)
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, delay);
        signal.addEventListener("abort", finish, { once: true });
      });
    if (!signal.aborted) onEvent(event);
  }
}
