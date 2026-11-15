import { ArrowUpRight } from "lucide-react";
import type { Brief, Finding, Item, Source } from "../lib/types";
import { safeUrl } from "../lib/stream";
export function References({
  ids,
  sources,
}: {
  ids: string[];
  sources: Source[];
}) {
  return (
    <span className="refs">
      {ids.map((id) => {
        const index = sources.findIndex((s) => s.id === id);
        const s = sources[index];
        return s ? (
          <a
            key={id}
            href={safeUrl(s.url)}
            target="_blank"
            rel="noreferrer"
            title={s.title}
          >
            [{index + 1}]
          </a>
        ) : null;
      })}
    </span>
  );
}
function Items({
  items,
  sources,
  ordered = false,
}: {
  items: Item[];
  sources: Source[];
  ordered?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className="brief-items">
      {items.map((item, i) => (
        <li key={i}>
          {item.text} <References ids={item.source_ids} sources={sources} />
          {item.status && (
            <small className={`status-label ${item.status}`}>
              {item.status === "reported" ? "Reported once" : item.status}
            </small>
          )}
        </li>
      ))}
    </Tag>
  );
}
export function Runway({
  brief,
  findings,
}: {
  brief: Brief;
  findings: Finding[];
}) {
  const start = Date.parse(brief.window.start),
    end = Math.max(Date.parse(brief.meeting_at), Date.parse(brief.window.end));
  const width = end - start || 1;
  const milestones = [...findings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(
      (f, i, all) => all.findIndex((other) => other.date === f.date) === i,
    )
    .slice(-4);
  const position = (date: string) =>
    Math.max(0, Math.min(92, ((Date.parse(date) - start) / width) * 92));
  return (
    <section className="runway-section" aria-label="30-day runway">
      <div className="row between">
        <h2 className="eyebrow">The 30-day runway</h2>
        <div className="legend">
          <span>━ Verified</span>
          <span>┄ Reported once</span>
          <span>┈ Unconfirmed</span>
        </div>
      </div>
      <div className="runway-scroll">
        <div className="runway runway-highlights">
          <div className="runway-cards">
            {milestones.map((f) => (
              <div className={`event-card ${f.status}`} key={f.id}>
                <time>{f.date}</time>
                <b>{f.title}</b>
                <References ids={f.source_ids} sources={brief.sources} />
              </div>
            ))}
          </div>
          <svg
            className="runway-connectors"
            viewBox="0 0 1000 90"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {milestones.map((f, i) => (
              <line
                key={f.id}
                x1={((i + 0.5) * 1000) / Math.max(1, milestones.length)}
                y1="0"
                x2={position(f.date) * 10}
                y2="85"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeDasharray={
                  f.status === "verified"
                    ? undefined
                    : f.status === "reported"
                      ? "7 4"
                      : "2 4"
                }
              />
            ))}
          </svg>
          <div className="baseline" />
          {milestones.map((f) => (
            <span
              className={`runway-dot ${f.status}`}
              key={f.id}
              style={{ left: `${position(f.date)}%` }}
            />
          ))}
          {[0, 0.25, 0.5, 0.75].map((n) => (
            <span
              className="runway-tick"
              style={{ left: `${n * 92}%` }}
              key={n}
            >
              {new Date(start + width * n).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </span>
          ))}
          <div className="meeting-flag">
            <b>
              Meeting ·{" "}
              {new Date(brief.meeting_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </b>
            <i />
          </div>
        </div>
      </div>
    </section>
  );
}
export default function BriefView({
  brief,
  findings = [],
  print = false,
}: {
  brief: Brief;
  findings?: Finding[];
  print?: boolean;
}) {
  if (print) {
    brief = {
      ...brief,
      headline: brief.headline.slice(0, 2),
      what_changed: brief.what_changed.slice(0, 2),
      who_to_know: brief.who_to_know.slice(0, 2),
      talking_points: brief.talking_points.slice(0, 2),
      questions: brief.questions.slice(0, 3),
      avoid: brief.avoid.slice(0, 1),
    };
    const used = new Set(
      [
        ...brief.headline,
        ...brief.numbers,
        ...brief.what_changed,
        ...brief.who_to_know,
        ...brief.talking_points,
        ...brief.questions,
        ...brief.avoid,
      ].flatMap((item) => item.source_ids),
    );
    brief = {
      ...brief,
      sources: brief.sources.filter((source) => used.has(source.id)),
    };
  }
  return (
    <div className={print ? "onepager" : "brief-view"}>
      <div className="brief-heading">
        <div className="eyebrow">
          {print ? "PreMatch / Your meeting brief" : "Your pre-meeting brief"}
        </div>
        <h1>{brief.subject}</h1>
        <p>
          {brief.with_person ? `With ${brief.with_person} · ` : ""}
          {new Date(brief.meeting_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        <span className="mono muted">
          Research: {brief.window.start} to {brief.window.end}
        </span>
      </div>
      {!print && <Runway brief={brief} findings={findings} />}
      {brief.headline.length > 0 && (
        <section className="headline">
          <h2>The short version</h2>
          <Items items={brief.headline} sources={brief.sources} />
        </section>
      )}
      <section className="numbers-section">
        <h2>
          <span>01</span> By the numbers
        </h2>
        <div className="numbers">
          {brief.numbers.map((n, i) => (
            <div key={i}>
              <strong>{n.value}</strong>
              <p>
                {n.label}{" "}
                <References ids={n.source_ids} sources={brief.sources} />
              </p>
              <small>{n.status}</small>
            </div>
          ))}
          <div>
            <strong>{brief.sources.length}</strong>
            <p>sources behind this brief</p>
          </div>
        </div>
      </section>
      <div className="brief-grid">
        <section>
          <h2>
            <span>02</span> What changed
          </h2>
          {brief.what_changed.length ? (
            <Items items={brief.what_changed} sources={brief.sources} />
          ) : (
            <p>No supported changes found in this window.</p>
          )}
        </section>
        <section>
          <h2>
            <span>03</span> Who to know
          </h2>
          {brief.who_to_know.length ? (
            <Items items={brief.who_to_know} sources={brief.sources} />
          ) : (
            <p>No verified people updates in this window.</p>
          )}
          {brief.avoid.length > 0 && (
            <>
              <h3 className="rust">Leave alone</h3>
              <Items items={brief.avoid} sources={brief.sources} />
            </>
          )}
        </section>
        <section className="questions">
          <h2>
            <span>04</span> What to ask
          </h2>
          <Items items={brief.questions} sources={brief.sources} ordered />
          {brief.talking_points.length > 0 && (
            <>
              <h3>Open with</h3>
              <Items items={brief.talking_points} sources={brief.sources} />
            </>
          )}
        </section>
      </div>
      <section className="sources">
        <h2>Sources</h2>
        <ol>
          {brief.sources.map((s, i) => (
            <li key={s.id}>
              <a href={safeUrl(s.url)} target="_blank" rel="noreferrer">
                [{i + 1}] {s.title}
                <ArrowUpRight size={12} />
              </a>
              <small>
                {s.domain} · {s.published_date || "Undated"}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
