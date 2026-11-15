"use client";
import { FilePdf } from "@phosphor-icons/react/dist/ssr/FilePdf";
import { PlusCircle } from "@phosphor-icons/react/dist/ssr/PlusCircle";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Brief, Finding, Telemetry } from "../lib/types";
import BriefView from "./BriefView";
import Hood from "./Hood";
import Voice from "./Voice";
export default function SavedBrief({
  id,
  print = false,
}: {
  id: string;
  print?: boolean;
}) {
  const [data, setData] = useState<{
    brief: Brief;
    findings: Finding[];
    telemetry: Telemetry;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/py/runs/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "This brief has expired or could not be found. Build a new one.",
          );
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id]);
  useEffect(() => {
    if (data && print) {
      document.fonts.ready.then(() => window.print());
    }
  }, [data, print]);
  return (
    <>
      <header className="header no-print">
        <Link className="logo" href="/">
          PreMatch
        </Link>
        <div className="row">
          <Link href="/" className="secondary new-brief">
            <PlusCircle size={18} weight="duotone" aria-hidden="true" /> New
            Brief
          </Link>
          {data && (
            <button
              className="primary"
              onClick={() =>
                print
                  ? window.print()
                  : window.open(
                      `/brief/${id}/print`,
                      "_blank",
                      "noopener,noreferrer",
                    )
              }
            >
              <FilePdf size={18} weight="duotone" aria-hidden="true" /> Download
              PDF
            </button>
          )}
        </div>
      </header>
      <main className={print ? "print-shell" : ""}>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : data ? (
          <>
            <BriefView
              brief={data.brief}
              findings={data.findings}
              print={print}
            />
            {!print && (
              <>
                <Voice briefId={id} />
                <footer>
                  <Hood telemetry={data.telemetry} />
                </footer>
              </>
            )}
          </>
        ) : (
          <p className="loading" role="status">
            Opening your brief…
          </p>
        )}
      </main>
    </>
  );
}
