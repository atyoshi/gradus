import { assignedSpecies, type Note, type Score, type Voice } from "./model.ts";

export function isClosingBar(score: Score, note: Note) {
  return note.time >= (score.bars - 1) * 8;
}

export function permitsRest(score: Score, voice: Voice, note: Note) {
  if (isClosingBar(score, note)) return false;
  const species = assignedSpecies(score, voice);
  if (species === 1) return false;
  if (species === 5) return true;
  if (species === 2 && score.voices.length === 2)
    return note.time === 0 && note.duration === 4;
  // Preserve documented delayed entries and downbeat rests in fuller studies.
  if (species === 4 && score.voices.length > 2 && note.time % 8 === 0 &&
      [4, 8].includes(note.duration)) return true;
  return note.time === 0 || voice.notes.every((n) => n.time >= note.time || n.rest);
}
