import type { Dispatch, SetStateAction } from "react";
import type { Score } from "./model";
export function PlaybackSettings({
  score,
  model,
  instrument,
  setInstrument,
  muted,
  setMuted,
  edit,
  onClose,
}: {
  score: Score;
  model: boolean;
  instrument: string;
  setInstrument: Dispatch<SetStateAction<string>>;
  muted: string[];
  setMuted: Dispatch<SetStateAction<string[]>>;
  edit: (fn: (s: Score) => void) => void;
  onClose: () => void;
}) {
  return (
    <section
      className="display-settings"
      aria-label="Playback and display settings"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <label className="setting-label">
        Instrument
        <select
          aria-label="Instrument"
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
        >
          {["piano", "cello", "violin"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="setting-label">
        Notation
        <select
          aria-label="Clefs"
          disabled={model}
          value={
            !score.clefs?.some(Boolean)
              ? "auto"
              : score.clefs.every((c) => c === "treble" || c === "bass")
                ? "modern"
                : score.clefs.every((c) => c === "alto" || c === "tenor")
                  ? "c"
                  : "custom"
          }
          onChange={(e) =>
            edit((s) => {
              s.clefs =
                e.target.value === "c"
                  ? s.voices.map((_, i) => (i === 0 ? "alto" : "tenor"))
                  : e.target.value === "modern"
                    ? s.voices.map((_, i) =>
                        i === s.voices.length - 1 ? "bass" : "treble",
                      )
                    : undefined;
            })
          }
        >
          <option value="auto">Automatic</option>
          <option value="modern">Treble/bass</option>
          <option value="custom" disabled>
            Custom
          </option>
          <option value="c">Alto & tenor clefs</option>
        </select>
      </label>
      <div className="voice-controls">
        {score.voices.map((v) => (
          <div key={v.id} className="voice-setting">
            <span className="voice-setting-name">
              {v.locked ? "Cantus firmus" : v.name}
            </span>
            <select
              aria-label={`Clef for ${v.name}`}
              value={score.clefs?.[score.voices.indexOf(v)] || ""}
              disabled={model}
              onChange={(e) => {
                const value = e.target.value;
                edit((s) => {
                  s.clefs = s.voices.map((_, i) =>
                    i === score.voices.indexOf(v) ? value : s.clefs?.[i] || "",
                  );
                });
              }}
            >
              <option value="">Automatic clef</option>
              <option value="treble">Treble clef</option>
              <option value="bass">Bass clef</option>
              <option value="alto">Alto clef</option>
              <option value="tenor">Tenor clef</option>
            </select>
            <button
              aria-label={`Mute ${v.name}`}
              aria-pressed={muted.includes(v.id)}
              className={muted.includes(v.id) ? "muted" : ""}
              onClick={() =>
                setMuted((xs) =>
                  xs.includes(v.id)
                    ? xs.filter((x) => x !== v.id)
                    : [...xs, v.id],
                )
              }
            >
              {muted.includes(v.id) ? "Muted" : "On"}
            </button>
            <button
              aria-label={`Solo ${v.name}`}
              aria-pressed={
                !muted.includes(v.id) &&
                score.voices.every((x) => x.id === v.id || muted.includes(x.id))
              }
              onClick={() =>
                setMuted(
                  score.voices.filter((x) => x.id !== v.id).map((x) => x.id),
                )
              }
            >
              Solo
            </button>
          </div>
        ))}
        <button className="text-button" onClick={() => setMuted([])}>
          Play all voices
        </button>
      </div>
      <button
        onClick={() => {
          onClose();
        }}
      >
        Close settings
      </button>
    </section>
  );
}
export function ExerciseActions({
  hasScore,
  onImport,
  onExport,
}: {
  hasScore: boolean;
  onImport: () => void;
  onExport: () => void;
}) {
  return (
    <div className="file-actions" aria-label="MusicXML files">
      <button onClick={onImport}>↑ Import MusicXML</button>
      <button disabled={!hasScore} onClick={onExport}>
        Export MusicXML ↓
      </button>
    </div>
  );
}
export function StudyHelp({
  busy,
  model,
  hint,
  onGuidance,
  onSample,
  onLesson,
}: {
  busy: boolean;
  model: boolean;
  hint: string;
  onGuidance: () => void;
  onSample: () => void;
  onLesson: () => void;
}) {
  return (
    <section className="score-secondary" aria-label="Study help">
      <div className="help">
        <button onClick={onLesson}>Lesson</button>
        <button disabled={busy} onClick={onGuidance}>
          Get guidance
        </button>
        <button disabled={busy} onClick={onSample}>
          {model ? "Return to my work" : "Sample answer"}
        </button>
      </div>
      {hint && (
        <p className="hint" role="status">
          {hint}
        </p>
      )}
    </section>
  );
}
