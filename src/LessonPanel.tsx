import { useEffect, useMemo, useState } from "react";
import { ScoreView } from "./ScoreView";
import { lessonById, lessonExamples, FUX_URL } from "./teaching";
import { play, stop } from "./audio";

export function LessonPanel({
  id,
  onReturn,
}: {
  id: string;
  onReturn: () => void;
}) {
  const lesson = lessonById(id);
  const examples = useMemo(() => lessonExamples(lesson.id), [lesson.id]);
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(-1),
    [error, setError] = useState("");
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setTime(-1);
    setError("");
    return () => stop();
  }, [id]);
  const example = examples[index] || examples[0];
  const halt = () => {
    stop();
    setPlaying(false);
    setTime(-1);
  };
  return (
    <section className="lesson-panel" aria-label={lesson.title}>
      <p className="eyebrow">LISTEN, COMPARE, TRY</p>
      <h2>{lesson.title}</h2>
      <p>{lesson.why}</p>
      <p className="lesson-action">
        <strong>Try this.</strong> {lesson.action}
      </p>
      {examples.length > 1 && (
        <div className="lesson-choices" aria-label="Example choices">
          {examples.map((e, i) => (
            <button
              key={e.title}
              className="button"
              aria-pressed={index === i}
              onClick={() => {
                halt();
                setIndex(i);
              }}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}
      <figure>
        <ScoreView
          score={example.score}
          selected=""
          onSelect={() => {}}
          onPitch={() => {}}
          findings={[]}
          time={time}
          inputDuration={null}
          readOnly
          zoom={1.25}
        />
        <figcaption>
          {example.caption} These short fragments illustrate one idea; they are
          not complete assessed exercises.
        </figcaption>
      </figure>
      <div className="lesson-controls">
        <button
          className="button primary"
          onClick={() => {
            if (playing) {
              halt();
              return;
            }
            setPlaying(true);
            setError("");
            play(
              example.score,
              80,
              [],
              0,
              example.score.bars * 8,
              false,
              setTime,
              () => {
                setPlaying(false);
                setTime(-1);
              },
            ).catch((e) => {
              setPlaying(false);
              setError(String(e));
            });
          }}
        >
          {playing ? "Stop example" : "Listen to example"}
        </button>
        <button
          className="button"
          onClick={() => {
            halt();
            onReturn();
          }}
        >
          Return to your exercise
        </button>
        <a href={FUX_URL} target="_blank" rel="noreferrer">
          Read the source · pp. {lesson.pages} ↗
        </a>
      </div>
      {error && (
        <p className="hint" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
