import { degree, type Score } from "./model";

/** Stable initial clefs: prefer the source register, then the draft, then voice position. */
export function initialClefs(score: Score): string[] {
  return score.voices.map((voice, index) => {
    const source = score.solution?.find((v) => v.id === voice.id);
    const notes = (
      source?.notes.some((n) => n.pitch) ? source.notes : voice.notes
    ).filter((n) => n.pitch && !n.rest);
    if (notes.length)
      return notes.reduce((sum, n) => sum + degree(n.pitch!), 0) /
        notes.length <
        28
        ? "bass"
        : "treble";
    const given = score.voices.findIndex((v) => v.locked);
    return given >= 0 && index > given ? "bass" : "treble";
  });
}
