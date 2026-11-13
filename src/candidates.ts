import { clone, degree, pitch, type Score, type Pitch } from "./model";
import { enterPitch } from "./entry";
import { check } from "./rules";

export function compatiblePitches(
  score: Score,
  noteId: string,
  inputDuration: number | null,
): Pitch[] {
  const voice = score.voices.find(
    (v) => !v.locked && v.notes.some((n) => n.id === noteId),
  );
  const note = voice?.notes.find((n) => n.id === noteId);
  if (!note || note.rest) return [];
  const center = note.pitch ? degree(note.pitch) : 31;
  const result: Pitch[] = [];
  for (
    let d = Math.max(0, Math.min(21, center - 7));
    d <= Math.min(62, Math.max(42, center + 7));
    d++
  ) {
    for (const alter of [0, -1, 1]) {
      const s = clone(score);
      enterPitch(s, noteId, { ...pitch(d), alter }, inputDuration);
      const changed = s.voices
        .flatMap((v) => v.notes)
        .filter((n) => {
          const old = score.voices
            .flatMap((v) => v.notes)
            .find((x) => x.id === n.id);
          return n.id === noteId || JSON.stringify(n) !== JSON.stringify(old);
        })
        .map((n) => n.id);
      if (
        !check(s).some(
          (f) =>
            (f.severity === "error" || f.basis === "review") &&
            f.notes.some((id) => changed.includes(id)),
        )
      )
        result.push({ ...pitch(d), alter });
    }
  }
  return result;
}
