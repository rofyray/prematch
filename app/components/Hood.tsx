"use client";
import { useRef } from "react";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal";
import type { Telemetry } from "../lib/types";
export default function Hood({ telemetry }: { telemetry?: Telemetry }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        className="secondary"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        Run Details{" "}
        <SlidersHorizontal weight="duotone" aria-hidden="true" size={15} />
      </button>
      <dialog
        ref={dialog}
        className="hood"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="hood-inner">
          <div className="row between">
            <h2>Run Details</h2>
            <button
              className="icon-button"
              aria-label="Close under the hood"
              onClick={() => dialog.current?.close()}
            >
              <X weight="duotone" aria-hidden="true" />
            </button>
          </div>
          <p>How this research ran, step by step.</p>
          {!telemetry ? (
            <p className="empty">
              Run a check to see model calls, source searches, and timings.
            </p>
          ) : (
            <>
              <section>
                <h3>This Run</h3>
                <ol className="calls">
                  {telemetry.calls.map((call, i) => (
                    <li key={i}>
                      <div>
                        <b>{call.agent}</b>
                        <small>
                          {call.model_served} · effort {call.effort}
                        </small>
                        <small>
                          {call.input_tokens.toLocaleString()} in /{" "}
                          {call.output_tokens.toLocaleString()} out
                          {call.cache_hit ? " · cached" : ""}
                          {call.fallback_used ? " · fallback" : ""}
                        </small>
                        {call.bifrost_request_id && (
                          <small className="break">
                            Request {call.bifrost_request_id}
                          </small>
                        )}
                      </div>
                      <span>{(call.latency_ms / 1000).toFixed(1)} s</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h3>Bifrost Gateway</h3>
                <dl className="metric-grid">
                  <div>
                    <dt>Model Calls</dt>
                    <dd>{telemetry.bifrost.calls}</dd>
                  </div>
                  <div>
                    <dt>Cache Hits</dt>
                    <dd>{telemetry.bifrost.cache_hits}</dd>
                  </div>
                  <div>
                    <dt>Fallbacks</dt>
                    <dd>{telemetry.bifrost.fallbacks}</dd>
                  </div>
                  <div>
                    <dt>Total Time</dt>
                    <dd>{(telemetry.total_ms / 1000).toFixed(1)} s</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>Tavily</h3>
                <dl className="metric-grid">
                  <div>
                    <dt>Credits</dt>
                    <dd>{telemetry.tavily.credits}</dd>
                  </div>
                  <div>
                    <dt>Searches</dt>
                    <dd>{telemetry.tavily.searches}</dd>
                  </div>
                  <div>
                    <dt>Reused Searches</dt>
                    <dd>{telemetry.tavily.cache_hits}</dd>
                  </div>
                  <div>
                    <dt>Fetch Mode</dt>
                    <dd>
                      {telemetry.tavily.live
                        ? "Live"
                        : "Cached where available"}
                    </dd>
                  </div>
                </dl>
              </section>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
