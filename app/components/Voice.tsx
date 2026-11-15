"use client";
import { useEffect, useRef, useState } from "react";
import { Microphone as Mic } from "@phosphor-icons/react/dist/ssr/Microphone";
import { Stop as Square } from "@phosphor-icons/react/dist/ssr/Stop";
import type { WebSession } from "@omnidim-ai/client";
export default function Voice({ briefId }: { briefId: string }) {
  const session = useRef<WebSession | null>(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  useEffect(
    () => () => {
      session.current?.stop();
    },
    [],
  );
  async function start() {
    setError("");
    setStatus("connecting");
    try {
      const response = await fetch("/api/py/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_id: briefId }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "The voice session could not start.");
      const { WebSession } = await import("@omnidim-ai/client");
      const current = new WebSession();
      session.current = current;
      current.on("status", (s) =>
        setStatus(typeof s === "string" ? s : "idle"),
      );
      current.on("transcript", (t) =>
        setTranscript(`${t.role === "agent" ? "Coach" : "You"}: ${t.text}`),
      );
      current.on("error", () =>
        setError("Voice connection interrupted. Try starting again."),
      );
      await current.start({ wsUrl: data.connection_url });
    } catch (e) {
      session.current?.stop();
      setStatus("idle");
      setError(
        e instanceof Error
          ? e.message
          : "Allow microphone access to talk to your brief.",
      );
    }
  }
  return (
    <section className="voice-bar" aria-label="Talk to Your Brief">
      <button
        className="mic-button"
        disabled={status === "connecting"}
        aria-label={
          status === "active"
            ? "Stop voice call"
            : "Start talking to your brief"
        }
        onClick={() => {
          if (status === "active") {
            session.current?.stop();
            setStatus("idle");
          } else void start();
        }}
      >
        {status === "active" ? (
          <Square weight="duotone" aria-hidden="true" size={21} />
        ) : (
          <Mic weight="duotone" aria-hidden="true" size={23} />
        )}
      </button>
      <div>
        <b>Talk to Your Brief</b>
        <p>
          {status === "connecting"
            ? "Connecting to your brief coach…"
            : status === "active"
              ? transcript || "Listening. Ask about your meeting."
              : "Try: “What should I open with?”"}
        </p>
        {error && (
          <p className="voice-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <span className="mono">
        {status === "active" ? "CALL LIVE" : "OmniDimension"}
      </span>
    </section>
  );
}
