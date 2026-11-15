"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { CalendarDots as CalendarDays } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { Flag } from "@phosphor-icons/react/dist/ssr/Flag";
import { PlusCircle as Plus } from "@phosphor-icons/react/dist/ssr/PlusCircle";
import { Broadcast as Radio } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Stop as Square } from "@phosphor-icons/react/dist/ssr/Stop";
import { NumberCircleOne } from "@phosphor-icons/react/dist/ssr/NumberCircleOne";
import { NumberCircleTwo } from "@phosphor-icons/react/dist/ssr/NumberCircleTwo";
import { NumberCircleThree } from "@phosphor-icons/react/dist/ssr/NumberCircleThree";
import { NumberCircleFour } from "@phosphor-icons/react/dist/ssr/NumberCircleFour";
import { NumberCircleFive } from "@phosphor-icons/react/dist/ssr/NumberCircleFive";
import { initial, reduceBrief } from "./lib/reducer";
import { postEvents } from "./lib/stream";
import { replayExample, type Example } from "./lib/replay";
import Examples from "./components/Examples";
import type { Candidate } from "./lib/types";
import BriefView from "./components/BriefView";
import { FilePdf } from "@phosphor-icons/react/dist/ssr/FilePdf";
import RunwayFlag from "./components/RunwayFlag";
import Hood from "./components/Hood";
import Voice from "./components/Voice";
import ShareBrief from "./components/ShareBrief";
import { useToast } from "./components/Toast";
const agents = [
  { name: "Cruyff", role: "Entity", Icon: NumberCircleOne },
  { name: "Assist", role: "Research Plan", Icon: NumberCircleTwo },
  { name: "Overlap", role: "Parallel Research", Icon: NumberCircleThree },
  { name: "VAR", role: "Source Checks", Icon: NumberCircleFour },
  { name: "Golazo", role: "Your Brief", Icon: NumberCircleFive },
];

export default function Home() {
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("auto");
  const [meeting, setMeeting] = useState("");
  const [zone, setZone] = useState("your local time");
  const [purpose, setPurpose] = useState("partnership");
  const [person, setPerson] = useState("");
  const [context, setContext] = useState("");
  const [state, dispatch] = useReducer(reduceBrief, initial);
  const [editing, setEditing] = useState(true);
  const notify = useToast();
  const [replaying, setReplaying] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(10, 0, 0, 0);
    setMeeting(
      new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    return () => abort.current?.abort();
  }, []);
  const running = state.status === "running";
  async function start(entity?: Candidate) {
    setReplaying(false);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    dispatch({ type: "reset", data: {} });
    setEditing(false);
    try {
      await postEvents(
        "/api/py/brief",
        {
          subject,
          subject_type: kind,
          meeting_at: new Date(meeting).toISOString(),
          purpose,
          with_person: person || undefined,
          my_context: context || undefined,
          entity,
        },
        dispatch,
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        dispatch({
          type: "run.error",
          data: {
            message:
              error instanceof Error
                ? error.message
                : "The brief could not be built. Please try again.",
          },
        });
    }
  }
  async function replay(example: Example) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    dispatch({ type: "reset", data: {} });
    setReplaying(true);
    setEditing(false);
    notify({
      tone: "info",
      title: "Playing recorded brief",
      message: `Recorded ${new Date(example.recorded_at).toLocaleDateString()}. No live searches are running.`,
    });
    setSubject(String(example.input.subject));
    await replayExample(example, dispatch, controller.signal);
  }
  function reset() {
    setReplaying(false);
    abort.current?.abort();
    dispatch({ type: "reset", data: {} });
    dispatch({ type: "run.completed", data: {} });
    setEditing(true);
  }
  return (
    <>
      <header className="header">
        <Link className="logo" href="/">
          <svg width="27" height="27" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M2 20h22M20 20V4" stroke="currentColor" strokeWidth="2" />
            <path d="M20 4h5l-2 3 2 3h-5z" fill="#c2410c" />
            <circle cx="7" cy="20" r="2.5" fill="currentColor" />
            <circle cx="13" cy="20" r="2.5" fill="currentColor" />
          </svg>
          PreMatch
        </Link>
        <div className="row">
          <span className="header-caption">
            A little preparation goes a long way.
          </span>
          <button className="secondary new-brief" onClick={reset}>
            <Plus weight="duotone" aria-hidden="true" size={16} />
            New Brief
          </button>
        </div>
      </header>
      <main>
        {replaying && (
          <p className="recorded-notice">
            Recorded Example · Replays without live searches.
          </p>
        )}
        {editing ? (
          <>
            <section className="setup">
              <div className="intro">
                <div className="eyebrow">
                  <Flag weight="duotone" aria-hidden="true" size={15} />
                  The last 30 days. Before the first hello.
                </div>
                <h1>
                  WALK IN
                  <br />
                  <em>READY.</em>
                </h1>
                <p>
                  What changed. Who matters. What to ask.
                  <br />A source-backed brief for your next conversation.
                </p>
                <div className="intro-runway" aria-hidden="true">
                  <span className="first-dot" />
                  <span className="second-dot" />
                  <span className="third-dot" />
                  <span className="intro-flag">
                    <RunwayFlag />
                  </span>
                  <small>30 days of context</small>
                  <b>Your Meeting</b>
                </div>
                <Examples onSelect={replay} />
                <div className="powered">
                  RESEARCH BY TAVILY <span> / </span> ROUTED BY BIFROST
                </div>
              </div>
              <form
                className="setup-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void start();
                }}
              >
                <div className="form-heading">
                  <span className="eyebrow">Set Up Your Brief</span>
                  <CalendarDays weight="duotone" aria-hidden="true" size={20} />
                </div>
                <label htmlFor="subject">Company or Person</label>
                <input
                  id="subject"
                  required
                  minLength={2}
                  maxLength={200}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Microsoft or Satya Nadella"
                />
                <div className="form-grid">
                  <div>
                    <label htmlFor="kind">Research</label>
                    <select
                      id="kind"
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="auto">Find Match</option>
                      <option value="company">Company</option>
                      <option value="person">Person</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="meeting">Meeting Date and Time</label>
                    <input
                      id="meeting"
                      type="datetime-local"
                      required
                      value={meeting}
                      onChange={(e) => setMeeting(e.target.value)}
                    />
                  </div>
                </div>
                <p className="timezone">Meeting time in {zone}</p>
                <fieldset className="purpose">
                  <legend>Meeting Purpose</legend>
                  {["partnership", "sales", "investor", "hiring", "other"].map(
                    (p) => (
                      <label
                        key={p}
                        className={purpose === p ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name="purpose"
                          value={p}
                          checked={purpose === p}
                          onChange={() => setPurpose(p)}
                        />
                        {p[0].toUpperCase() + p.slice(1)}
                      </label>
                    ),
                  )}
                </fieldset>
                <details>
                  <summary>Add Context</summary>
                  <label htmlFor="person">Meeting With</label>
                  <input
                    id="person"
                    value={person}
                    maxLength={200}
                    onChange={(e) => setPerson(e.target.value)}
                    placeholder="Name or role"
                  />
                  <label htmlFor="context">Discussion Topics</label>
                  <textarea
                    id="context"
                    value={context}
                    maxLength={2000}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Your role, what you offer, and what you want to learn."
                  />
                </details>
                <button
                  type="submit"
                  className="primary build-button"
                  disabled={running}
                >
                  Build Brief
                  <ArrowRight weight="duotone" aria-hidden="true" size={18} />
                </button>
                <p className="form-note">
                  Public sources only. Saved briefs are available for 7 days.
                </p>
              </form>
            </section>
            <section className="preparation">
              <div>
                <b>Context You Can Check.</b>
                <p>
                  Sources on every finding. Clear labels for what is verified,
                  reported, or still uncertain.
                </p>
              </div>
              <div>
                <b>Questions Worth Bringing.</b>
                <p>
                  Talking points shaped around your meeting, with a one-page
                  brief to take along.
                </p>
              </div>
              <div>
                <b>Rehearse Out Loud.</b>
                <p>
                  Talk through the brief with a voice coach before you join the
                  call.
                </p>
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="agent-strip">
              <ol aria-label="Research agents in order">
                {agents.map(({ name, role, Icon }) => (
                  <li key={name}>
                    <Icon size={28} weight="duotone" aria-hidden="true" />
                    <div>
                      <b>{name}</b>
                      <span>{role}</span>
                    </div>
                  </li>
                ))}
              </ol>
              {state.telemetry && (
                <span
                  className="agent-duration"
                  aria-label="Total research time"
                >
                  {(state.telemetry.total_ms / 1000).toFixed(1)} s
                </span>
              )}
            </div>
            {running && (
              <section className="progress-panel">
                <div className="row between">
                  <h2>
                    <Radio weight="duotone" aria-hidden="true" size={19} />
                    Getting you up to speed
                  </h2>
                  <button
                    className="secondary"
                    onClick={() => {
                      abort.current?.abort();
                      dispatch({
                        type: "run.error",
                        data: {
                          message:
                            "Research stopped. You can build a new brief when you are ready.",
                        },
                      });
                    }}
                  >
                    <Square weight="duotone" aria-hidden="true" size={13} />
                    Stop
                  </button>
                </div>
                <p>
                  {Object.keys(state.sections).length
                    ? "Researching each section in parallel. Findings appear as sources are checked."
                    : "Resolving the subject and planning the research."}
                </p>
                <div className="section-progress">
                  {Object.entries(state.sections).map(([section, status]) => (
                    <div key={section}>
                      <b>{section}</b>
                      <span>{status}</span>
                    </div>
                  ))}
                </div>
                {Object.entries(state.partial).map(([name, items]) => (
                  <section key={name}>
                    <h3>
                      {name
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    </h3>
                    <ul>
                      {items.map((item, index) => (
                        <li key={index}>
                          {item.text || `${item.value}: ${item.label}`}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {state.findings.length > 0 && (
                  <ul>
                    {state.findings.map((f) => (
                      <li key={f.id}>
                        {f.title} <small>{f.date}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {state.status === "clarify" && (
              <section className="clarify">
                <div className="eyebrow">One quick clarification</div>
                <h1>WHICH {subject.toUpperCase()}?</h1>
                <p>Choose the company or person you are meeting.</p>
                <div>
                  {state.candidates.map((c) => (
                    <article key={c.name + c.domain}>
                      <span className="eyebrow">{c.kind}</span>
                      <b>{c.name}</b>
                      <p>{c.description}</p>
                      <span>{c.domain}</span>
                      <button onClick={() => void start(c)}>
                        Select{" "}
                        <ArrowRight
                          weight="duotone"
                          aria-hidden="true"
                          size={16}
                        />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {state.brief && (
              <>
                {!replaying && (
                  <div className="brief-actions">
                    <button
                      className="secondary"
                      onClick={() =>
                        window.open(
                          `/brief/${state.runId}/print`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      Download PDF
                      <FilePdf weight="duotone" aria-hidden="true" size={18} />
                    </button>
                    {state.runId && <ShareBrief briefId={state.runId} />}
                    <a href={`/brief/${state.runId}`}>
                      Open Brief
                      <ArrowRight
                        weight="duotone"
                        aria-hidden="true"
                        size={16}
                      />
                    </a>
                  </div>
                )}
                <BriefView brief={state.brief} findings={state.findings} />
                {state.runId && !replaying && <Voice briefId={state.runId} />}
              </>
            )}
          </>
        )}
        {state.error && (
          <div className="error" role="alert">
            <span>{state.error}</span>
            <button onClick={() => setEditing(true)}>Try Again</button>
          </div>
        )}
      </main>
      <footer>
        <span className="mono">PreMatch / A better first conversation.</span>
        <Hood telemetry={state.telemetry} />
      </footer>
    </>
  );
}
