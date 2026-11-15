"use client";
import { useEffect, useRef, useState } from "react";
import { Microphone as Mic } from "@phosphor-icons/react/dist/ssr/Microphone";
import { Stop as Square } from "@phosphor-icons/react/dist/ssr/Stop";
import { connectVoice } from "../lib/voice-session";
export default function Voice({ briefId }: { briefId: string }) {
  const connection = useRef<AbortController | null>(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  useEffect(
    () => () => {
      connection.current?.abort();
    },
    [briefId],
  );
  async function start() {
    connection.current?.abort();
    const controller = new AbortController();
    connection.current = controller;
    setError("");
    setStatus("connecting");
    try {
      await connectVoice(briefId, controller.signal, (current) => {
        current.on("status", (s) => {
          if (!controller.signal.aborted)
            setStatus(typeof s === "string" ? s : "idle");
        });
        current.on("transcript", (t) => {
          if (!controller.signal.aborted)
            setTranscript(`${t.role === "agent" ? "Coach" : "You"}: ${t.text}`);
        });
        current.on("error", () => {
          if (!controller.signal.aborted)
            setError("Voice connection interrupted. Try starting again.");
        });
      });
    } catch (e) {
      if (controller.signal.aborted) return;
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
            connection.current?.abort();
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
