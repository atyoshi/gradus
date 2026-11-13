import { label, type Score, type Finding } from "./model";
/** Measures touched by a finding, including a held note spanning a barline. */
export function findingBars(score: Score, finding: Finding): number[] {
  const ids = new Set(finding.notes);
  const bars = new Set<number>();
  for (const voice of score.voices)
    for (const note of voice.notes)
      if (ids.has(note.id)) {
        const first = Math.floor(note.time / 8),
          last = Math.ceil((note.time + note.duration) / 8) - 1;
        for (let b = first; b <= last; b++)
          if (b >= 0 && b < score.bars) bars.add(b + 1);
      }
  return [...bars].sort((a, b) => a - b);
}
export function barLabel(bars: number[]): string {
  if (!bars.length) return "";
  if (bars.length === 1) return `Bar ${bars[0]}`;
  const consecutive = bars.every((b, i) => i === 0 || b === bars[i - 1] + 1);
  return `Bars ${consecutive ? `${bars[0]}–${bars.at(-1)}` : bars.join(", ")}`;
}
export function measureFeedback(score: Score, findings: Finding[]) {
  const result = new Map<number, "error" | "suggestion">();
  for (const finding of findings) {
    if (finding.rule === "checking") continue;
    for (const bar of findingBars(score, finding))
      if (result.get(bar) !== "error") result.set(bar, finding.severity);
  }
  return result;
}

/** Keep each voice's finding spans and severity independent of other staves. */
export function voiceMeasureFeedback(score: Score, findings: Finding[]) {
  const result = new Map<string, Map<number, "error" | "suggestion">>();
  for (const voice of score.voices) {
    const states = measureFeedback({ ...score, voices: [voice] }, findings);
    if (states.size) result.set(voice.id, states);
  }
  return result;
}

/** Explain the diagnosed event without changing the checker’s musical verdict. */
export function violationText(score: Score, finding: Finding): string {
  if (finding.rule !== "dissonance") return finding.message;
  const located = score.voices
    .flatMap((v) => v.notes.map((n, i) => ({ v, n, i })))
    .filter(({ n }) => finding.notes.includes(n.id));
  const event =
    located.find(
      ({ v, n }) =>
        (v.species ?? score.species) === 4 && !v.locked && n.time % 8 !== 0,
    ) ||
    located.find(({ v }) => (v.species ?? score.species) === 4 && !v.locked);
  if (!event) {
    // A held partner belongs to the interval, but its own approach/departure
    // is not the moving note's dissonance treatment.
    if (located.length === 2) {
      const [held, moving] = [...located].sort((a, b) => a.n.time - b.n.time);
      if (
        !moving.v.locked &&
        !moving.n.tieStop &&
        held.n.time < moving.n.time &&
        held.n.time + held.n.duration > moving.n.time
      )
        return `${finding.message} This treatment concerns ${moving.v.name}'s ${label(moving.n.pitch)}. ${held.v.name}'s held ${label(held.n.pitch)} is highlighted as the other note in the interval; it does not need to approach or leave by step here.`;
    }
    return finding.message;
  }
  const { v, n, i } = event;
  if (!n.tieStop)
    return n.time % 8 === 0
      ? "This downbeat dissonance is attacked without a prepared tie."
      : "This weak-half dissonance cannot serve as a consonant preparation for the next tie.";
  const p = v.notes[i - 1],
    q = v.notes[i + 1];
  if (
    !p?.tieStart ||
    !p.pitch ||
    !n.pitch ||
    p.pitch.step !== n.pitch.step ||
    p.pitch.octave !== n.pitch.octave ||
    p.pitch.alter !== n.pitch.alter
  )
    return "This dissonance has no matching tied preparation.";
  if (
    q?.pitch &&
    q.pitch.octave * 7 +
      "CDEFGAB".indexOf(q.pitch.step) -
      (n.pitch.octave * 7 + "CDEFGAB".indexOf(n.pitch.step)) !==
      -1
  )
    return "This dissonant suspension does not resolve down by step.";
  return "This suspension needs a supported preparation and a consonant downward resolution.";
}

/** Present historical editorial context without grading the student's writing. */
export function historicalNotes(score: Score): string[] {
  return (score.source?.editorialNotes || [])
    .map((note) => {
      if (
        note.includes("upper clef is printed as C3") &&
        note.includes("opening uses C1")
      )
        return "The original edition may contain a printing error: the upper voice begins in soprano clef, but the next system shows alto clef. The melody and printed interval numbers suggest that soprano clef was intended throughout. This is a detail of the historical edition, not a mistake in your notes.";
      return note
        .replace(/[^.!?]*\bsource\.systems\b[^.!?]*(?:[.!?]|$)/g, "")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean);
}
