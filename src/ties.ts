import { assignedSpecies, type Score, type Voice } from "./model.ts";
export function extendedTieNotes(voice: Voice) {
  return voice.notes.filter(
    (n, i) =>
      n.tieStop &&
      n.tieStart &&
      !n.rest &&
      voice.notes[i - 1]?.tieStart &&
      voice.notes[i + 1]?.tieStop &&
      voice.notes[i - 1].time + voice.notes[i - 1].duration === n.time &&
      n.time + n.duration === voice.notes[i + 1].time,
  );
}
export function extendedTieReason(score: Score, voice: Voice, index: number) {
  if (![4, 5].includes(assignedSpecies(score, voice))) return null;
  if (voice.notes[index].tieStop || voice.notes[index + 1]?.tieStart)
    return assignedSpecies(score, voice) === 4
      ? "This note already belongs to a tied pair. Release it before preparing the next suspension."
      : "Extended ties are outside the documented florid study pattern.";
  return null;
}
