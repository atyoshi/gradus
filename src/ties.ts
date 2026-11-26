import { assignedSpecies, type Note, type Score, type Voice } from "./model.ts";

export function crossesBarline(note: Note, next: Note) {
  return note.time + note.duration === next.time &&
    next.time % 8 === 0 && note.time < next.time;
}

export function permitsSpeciesTie(score: Score, voice: Voice, note: Note) {
  const species = assignedSpecies(score, voice);
  // Fuller second-species source cadences tie an upbeat into the penultimate bar.
  return species >= 4 ||
    (species === 2 && score.voices.length > 2 && note.duration === 4 &&
      note.time + note.duration === (score.bars - 2) * 8);
}
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
