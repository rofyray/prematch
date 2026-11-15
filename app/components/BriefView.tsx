import Runway from "./Runway";
import { LinkSimple } from "@phosphor-icons/react/dist/ssr/LinkSimple";
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
              {item.status === "reported" ? "Reported Once" : item.status}
            </small>
          )}
        </li>
      ))}
    </Tag>
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
          {print ? "PreMatch / Your meeting brief" : "Your Pre-meeting Brief"}
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
          <h2>The Short Version</h2>
          <Items items={brief.headline} sources={brief.sources} />
        </section>
      )}
      <section className="numbers-section">
        <h2>
          <span>01</span> By the Numbers
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
            <span>02</span> What Changed
          </h2>
          {brief.what_changed.length ? (
            <Items items={brief.what_changed} sources={brief.sources} />
          ) : (
            <p>No supported changes found in this window.</p>
          )}
        </section>
        <section>
          <h2>
            <span>03</span> Who to Know
          </h2>
          {brief.who_to_know.length ? (
            <Items items={brief.who_to_know} sources={brief.sources} />
          ) : (
            <p>No verified people updates in this window.</p>
          )}
          {brief.avoid.length > 0 && (
            <>
              <h3 className="rust">Leave Alone</h3>
              <Items items={brief.avoid} sources={brief.sources} />
            </>
          )}
        </section>
        <section className="questions">
          <h2>
            <span>04</span> What to Ask
          </h2>
          <Items items={brief.questions} sources={brief.sources} ordered />
          {brief.talking_points.length > 0 && (
            <>
              <h3>Open With</h3>
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
                <LinkSimple weight="duotone" aria-hidden="true" size={12} />
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
