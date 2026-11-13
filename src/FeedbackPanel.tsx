import { label, type Score, type Finding } from "./model";
import {
  barLabel,
  findingBars,
  violationText,
  historicalNotes,
} from "./feedback";
import { intervalName, type MusicalAnalysis } from "./analysis";

const ruleName = (rule: string) =>
  rule.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase());
function Findings({
  score,
  findings,
  analysis,
  selected,
  onSelect,
  onLesson,
  review = false,
}: {
  score: Score;
  findings: Finding[];
  analysis: MusicalAnalysis | null;
  selected: string;
  onSelect: (id: string) => void;
  onLesson: (id: string) => void;
  review?: boolean;
}) {
  const choose = (ids: string[]) =>
    onSelect(
      ids.find((id) =>
        score.voices.some((v) => !v.locked && v.notes.some((n) => n.id === id)),
      ) || ids[0],
    );
  const groups = [
    {
      title: "Rule violations",
      severity: "error",
      items: findings.filter((f) => f.severity === "error"),
    },
    {
      title: "Needs context",
      severity: "suggestion",
      items: findings.filter(
        (f) => f.severity !== "error" && f.basis === "review",
      ),
    },
    {
      title: "Suggestions",
      severity: "suggestion",
      items: findings.filter(
        (f) =>
          f.severity === "suggestion" &&
          f.basis !== "review" &&
          f.rule !== "checking",
      ),
    },
  ];
  const selectedNote = score.voices
    .flatMap((v) => v.notes)
    .find((n) => n.id === selected);
  const related = (f: Finding) =>
    f.notes.includes(selected) ||
    (!!selectedNote &&
      findingBars(score, f).includes(Math.floor(selectedNote.time / 8) + 1));
  return (
    <>
      <div className="finding-groups">
        {groups
          .filter(
            (g) =>
              (review
                ? g.title === "Suggestions"
                : g.title !== "Suggestions") && g.items.length,
          )
          .map((group) => (
            <section
              key={group.title}
              className={`feedback-group ${group.severity}`}
              aria-label={group.title}
            >
              <h3
                id={
                  group.title === "Needs context"
                    ? "feedback-context"
                    : undefined
                }
              >
                <span className="severity-dot" />
                {group.title} · {group.items.length}
              </h3>
              <div className="findings">
                {[...group.items]
                  .sort(
                    (a, b) =>
                      Math.min(...findingBars(score, a)) -
                      Math.min(...findingBars(score, b)),
                  )
                  .map((f, i) => (
                    <article
                      className={`finding-item ${related(f) ? "selected-finding" : ""}`}
                      key={f.rule + f.notes.join() + i}
                    >
                      <button
                        className={`finding ${f.severity}`}
                        onClick={() => choose(f.notes)}
                      >
                        <span>{ruleName(f.rule)}</span>
                        <span className="finding-bars">
                          {barLabel(findingBars(score, f))}
                        </span>
                      </button>
                      <div className="finding-body">
                        <p>{violationText(score, f)}</p>
                        {f.details && (
                          <p className="finding-details">
                            {score.voices
                              .map((v) => {
                                const ns = v.notes.filter((n) =>
                                  f.notes.includes(n.id),
                                );
                                return ns.length
                                  ? `${v.name}: ${ns.map((n) => `${label(n.pitch)}, bar ${Math.floor(n.time / 8) + 1}, beat ${1 + (n.time % 8) / 2}`).join("; ")}`
                                  : "";
                              })
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        <details className="finding-reference">
                          <summary>Rule details</summary>
                          <p className="finding-basis">
                            {f.basis === "exercise"
                              ? "Study requirement"
                              : f.basis === "craft"
                                ? "Craft advice"
                                : f.basis === "review"
                                  ? "Needs context"
                                  : "Rule"}
                          </p>
                          <p className="finding-source">{f.source}</p>
                          {f.reference && (
                            <a
                              href={f.reference.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {f.reference.title} · {f.reference.pages}
                            </a>
                          )}
                          {f.lessonId && (
                            <button
                              className="text-button finding-lesson"
                              onClick={() => onLesson(f.lessonId!)}
                            >
                              Read the rule and hear an example →
                            </button>
                          )}
                        </details>
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        {review && !!analysis?.strengths.length && (
          <section className="feedback-group strengths" aria-label="Strengths">
            <h3>
              <span className="severity-dot" />
              Strengths
              <span className="finding-count">{analysis.strengths.length}</span>
            </h3>
            {analysis.strengths.map((s, i) => (
              <article className="strength-item" key={i}>
                <button className="finding" onClick={() => choose(s.notes)}>
                  <span>{s.title}</span>
                  <span className="finding-bars">
                    {barLabel(
                      findingBars(score, { notes: s.notes } as Finding),
                    )}
                  </span>
                </button>
                <p>{s.text}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </>
  );
}

export function AnalysisPanel({
  analysis,
}: {
  analysis: MusicalAnalysis | null;
}) {
  return (
    <>
      {analysis && (
        <section className="analysis-panel" aria-label="Musical analysis">
          <div className="analysis-heading">
            <h3>Musical review{analysis.partial ? " · So far" : ""}</h3>
            <span>{analysis.voice}</span>
          </div>
          <div className="analysis-metrics">
            {analysis.stepPercent !== undefined && (
              <div>
                <strong>{analysis.stepPercent}%</strong>
                <span>Steps in moving attacks</span>
              </div>
            )}
            {analysis.comparedAttacks > 0 && (
              <>
                <div>
                  <strong>{analysis.leaps}</strong>
                  <span>Leaps</span>
                </div>
                <div>
                  <strong>{analysis.repeats}</strong>
                  <span>Repeated attacks</span>
                </div>
              </>
            )}
            {analysis.range !== undefined && (
              <div>
                <strong>{intervalName(analysis.range)}</strong>
                <span>Range</span>
              </div>
            )}
            {!!analysis.intervals && (
              <div>
                <strong>
                  {analysis.thirdsSixths} of {analysis.intervals}
                </strong>
                <span>3rds and 6ths with cantus</span>
              </div>
            )}
          </div>
          {analysis.range === undefined && (
            <p>Write some notes to begin the musical analysis.</p>
          )}
          {analysis.range !== undefined && (
            <details>
              <summary>Read the analysis</summary>
              <p>
                {analysis.steps} steps, {analysis.leaps} leaps, and{" "}
                {analysis.repeats} repeated attacks. Tied continuations are
                excluded; rests and unwritten slots break melodic comparisons.
              </p>
              {analysis.high && (
                <p>
                  The highest written pitch is {analysis.high}
                  {analysis.highBars.length
                    ? `, attacked in ${barLabel(analysis.highBars).toLowerCase()}`
                    : ""}
                  . {analysis.recovered}{" "}
                  {analysis.recovered === 1 ? "leap is" : "leaps are"} answered
                  by a step in the opposite direction.
                </p>
              )}
              {analysis.comparison && (
                <>
                  <p>
                    Compared with {analysis.comparison} on known downbeats:{" "}
                    {analysis.contrary} contrary, {analysis.similar} similar,{" "}
                    {analysis.oblique} oblique, and {analysis.stationary}{" "}
                    stationary transitions.
                  </p>
                  <p>
                    These observations describe the written passage. Thirds and
                    sixths include compound intervals; downbeat counts do not
                    grade suspension dissonances or intervening notes.
                  </p>
                </>
              )}
            </details>
          )}
        </section>
      )}
    </>
  );
}

type FindingProps = Omit<Parameters<typeof Findings>[0], "review">;
export function RuleFeedback(props: FindingProps) {
  return <Findings {...props} />;
}
export function ReviewFindings(props: FindingProps) {
  return <Findings {...props} review />;
}

export function HistoricalNotes({ score }: { score: Score }) {
  const notes = historicalNotes(score);
  if (!notes.length) return null;
  return (
    <section className="historical-notes" aria-label="Historical notes">
      <details>
        <summary>Did you know?</summary>
        {notes.map((note, i) => (
          <p key={i}>{note}</p>
        ))}
        {score.source?.url && (
          <a href={score.source.url} target="_blank" rel="noreferrer">
            See the original edition ↗
          </a>
        )}
      </details>
    </section>
  );
}
