"use client";
import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import type { Brief, Finding } from "../lib/types";
import { layoutTimeline } from "../lib/timeline";
import { safeUrl } from "../lib/stream";
import RunwayFlag from "./RunwayFlag";

export default function Runway({
  brief,
  findings,
}: {
  brief: Brief;
  findings: Finding[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const [width, setWidth] = useState(900);
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const sorted = [...findings].sort((a, b) => a.date.localeCompare(b.date));
  const pageSize = width < 600 ? 4 : Math.max(1, sorted.length);
  const pages = Math.ceil(sorted.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const milestones = sorted.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const start = Date.parse(brief.window.start);
  const end = Math.max(
    Date.parse(brief.meeting_at),
    Date.parse(brief.window.end),
  );
  const layout = layoutTimeline(
    milestones.map((f) => f.date),
    start,
    end,
    width,
  );
  const selected = milestones.find((f) => f.id === active);
  function closeDetails() {
    if (active) document.getElementById(`runway-trigger-${active}`)?.focus();
    pinned.current = false;
    setActive(null);
  }
  function openDetails(id: string) {
    pinned.current = true;
    setActive(id);
    requestAnimationFrame(() => {
      detail.current?.focus({ preventScroll: true });
      detail.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }
  const dateLabel = (date: number) =>
    new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <section
      className="runway-section"
      aria-label="30-day runway"
      onKeyDown={(e) => {
        if (e.key === "Escape") closeDetails();
      }}
    >
      <div className="row between runway-heading">
        <h2 className="eyebrow">The 30-Day Runway</h2>
        <div className="legend">
          <span>━ Verified</span>
          <span>┄ Reported Once</span>
          <span>┈ Unconfirmed</span>
        </div>
      </div>
      {pages > 1 && (
        <div className="runway-pages row between">
          <span>
            {currentPage * pageSize + 1}–
            {Math.min((currentPage + 1) * pageSize, sorted.length)} of{" "}
            {sorted.length} Updates
          </span>
          <div className="row">
            <button
              className="secondary"
              disabled={currentPage === 0}
              onClick={() => {
                setPage(currentPage - 1);
                setActive(null);
                pinned.current = false;
              }}
            >
              Earlier
            </button>
            <button
              className="secondary"
              disabled={currentPage + 1 >= pages}
              onClick={() => {
                setPage(currentPage + 1);
                setActive(null);
                pinned.current = false;
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}
      <div
        ref={container}
        className="runway-map"
        style={{ height: layout.height }}
      >
        <svg
          className="runway-wires"
          width={width}
          height={layout.height}
          aria-hidden="true"
        >
          <path
            d={`M 8 ${layout.axis} H ${layout.flagX + 2}`}
            className="runway-axis"
          />
          {layout.items.map((item, i) => (
            <g
              key={milestones[i].id}
              className={`${milestones[i].status} ${active === milestones[i].id ? "is-active" : ""}`}
            >
              <path d={item.path} className="runway-wire" />
              <circle
                cx={item.dot}
                cy={layout.axis}
                r={active === milestones[i].id ? 5 : 3.5}
                className="runway-point"
              />
            </g>
          ))}
        </svg>
        {layout.items.map((item, i) => {
          const finding = milestones[i];
          return (
            <article
              key={finding.id}
              className={`runway-card ${finding.status} ${active === finding.id ? "is-active" : ""}`}
              style={{
                left: item.x,
                top: item.y,
                width: item.cardWidth,
                height: item.cardHeight,
                animationDelay: `${Math.min(i * 35, 280)}ms`,
              }}
              onPointerMove={(e) => {
                if (e.pointerType === "mouse" && !pinned.current)
                  setActive(finding.id);
              }}
            >
              <time dateTime={finding.date}>
                {dateLabel(Date.parse(finding.date))}
              </time>
              <h3 title={finding.title}>{finding.title}</h3>
              <button
                id={`runway-trigger-${finding.id}`}
                type="button"
                aria-expanded={active === finding.id}
                aria-controls="runway-detail"
                aria-label={`Details: ${finding.title}`}
                onClick={() => openDetails(finding.id)}
              >
                Details{" "}
                <CaretDown size={13} weight="duotone" aria-hidden="true" />
              </button>
            </article>
          );
        })}
        <div
          className="runway-end"
          style={{ left: layout.flagX, top: layout.axis - 99 }}
        >
          <RunwayFlag />
          <span>
            Meeting
            <br />
            {dateLabel(Date.parse(brief.meeting_at))}
          </span>
        </div>
        {[0, 0.5].map((n) => (
          <time
            key={n}
            className="runway-date"
            style={{ left: 8 + n * (width - 40), top: layout.axis + 12 }}
          >
            {dateLabel(start + (end - start) * n)}
          </time>
        ))}
      </div>
      {!milestones.length && (
        <p className="muted">Dated updates will appear as research arrives.</p>
      )}
      <div
        ref={detail}
        tabIndex={-1}
        role="region"
        aria-label="Update details"
        id="runway-detail"
        className={`runway-detail ${selected ? "is-open" : ""}`}
      >
        {selected ? (
          <>
            <div className="row between">
              <span className="eyebrow">
                {selected.date} ·{" "}
                {selected.status === "reported"
                  ? "Reported Once"
                  : selected.status}
              </span>
              <button
                className="icon-button"
                aria-label="Close details"
                onClick={closeDetails}
              >
                <X size={17} weight="duotone" aria-hidden="true" />
              </button>
            </div>
            <h3>{selected.title}</h3>
            <p>{selected.summary}</p>
            <div className="refs">
              {selected.source_ids.map((id) => {
                const index = brief.sources.findIndex((s) => s.id === id);
                const source = brief.sources[index];
                return source ? (
                  <a
                    key={id}
                    href={safeUrl(source.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    [{index + 1}] {source.domain}
                  </a>
                ) : null;
              })}
            </div>
          </>
        ) : (
          <p>Hover over an update or choose Details to explore its sources.</p>
        )}
      </div>
    </section>
  );
}
