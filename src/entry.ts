import { extendedTieReason } from "./ties";
import {
  type Score,
  type Voice,
  type Note,
  type Pitch,
  clone,
  assignedSpecies,
} from "./model";

function untouchedMeasure(voice: Voice, note: Note) {
  const start = Math.floor(note.time / 8) * 8;
  return voice.notes
    .filter((n) => n.time >= start && n.time < start + 8)
    .every((n) => !n.pitch && !n.rest && !n.tieStart && !n.tieStop);
}

// Explicit rhythm edits replace the remainder of the selected measure.
export function resizeMeasure(v: Voice, note: Note, duration: number) {
  const end = (Math.floor(note.time / 8) + 1) * 8;
  if (duration <= 0 || note.time + duration > end)
    throw Error("The note would extend beyond this bar.");
  const notes = [{ ...note, duration, tieStart: false, tieStop: false }];
  for (let time = note.time + duration; time < end; time += duration) {
    notes.push({
      id: `${v.id}n${time}`,
      time,
      duration: Math.min(duration, end - time),
      pitch: null,
      rest: false,
      tieStart: false,
      tieStop: false,
    });
  }
  v.notes = [
    ...v.notes.filter((n) => n.time < note.time),
    ...notes,
    ...v.notes.filter((n) => n.time >= end),
  ];
}

export function entryDuration(
  score: Score,
  id: string,
  preferred: number | null,
): number {
  const voice = score.voices.find((v) => v.notes.some((n) => n.id === id));
  const note = voice?.notes.find((n) => n.id === id);
  if (!voice || !note) return 8;
  const start = Math.floor(note.time / 8) * 8;
  return preferred !== null &&
    !score.path &&
    !voice.locked &&
    untouchedMeasure(voice, note)
    ? Math.min(preferred, start + 8 - note.time)
    : note.duration;
}

// Called only as part of a committed note entry, never during selection/preview.
export function prepareEntry(
  score: Score,
  id: string,
  preferred: number | null,
) {
  const voice = score.voices.find(
    (v) => !v.locked && v.notes.some((n) => n.id === id),
  );
  const note = voice?.notes.find((n) => n.id === id);
  if (!voice || !note) return;
  const duration = entryDuration(score, id, preferred);
  if (preferred !== null && !score.path && untouchedMeasure(voice, note))
    resizeMeasure(voice, note, duration);
  return voice.notes.find((n) => n.id === id);
}

export function restoreSelection(target: Score, previous: Score, id: string) {
  if (target.voices.some((v) => v.notes.some((n) => n.id === id))) return id;
  const voice = previous.voices.find((v) => v.notes.some((n) => n.id === id));
  const note = voice?.notes.find((n) => n.id === id);
  const restored = target.voices.find((v) => v.id === voice?.id);
  return (
    restored?.notes.find(
      (n) => note && n.time <= note.time && n.time + n.duration > note.time,
    )?.id ||
    target.voices.find((v) => !v.locked)?.notes[0]?.id ||
    ""
  );
}

/** One operation for committed entry and candidate evaluation, including tied chains. */
export function enterPitch(
  score: Score,
  id: string,
  value: Pitch,
  preferred: number | null,
) {
  const note = prepareEntry(score, id, preferred);
  const voice = score.voices.find(
    (v) => !v.locked && v.notes.some((n) => n.id === id),
  );
  if (!note || !voice) return;
  const index = voice.notes.indexOf(note);
  const next = voice.notes[index + 1];
  // Some source rhythms contain breaks in the suspension pattern. While
  // writing a fourth-species upbeat, prepare the next blank downbeat.
  // Written downbeats, explicit rests, and the whole-note cadence stay intact.
  if (
    assignedSpecies(score, voice) === 4 &&
    !note.rest &&
    !note.tieStart &&
    !note.tieStop &&
    note.time % 8 === 4 &&
    note.duration === 4 &&
    next &&
    next.time === note.time + 4 &&
    next.duration === 4 &&
    !next.pitch &&
    !next.rest &&
    !next.tieStart &&
    !next.tieStop
  ) {
    note.tieStart = true;
    next.tieStop = true;
  }
  let first = voice.notes.indexOf(note),
    last = first;
  while (
    first > 0 &&
    voice.notes[first].tieStop &&
    voice.notes[first - 1].tieStart &&
    !voice.notes[first - 1].rest
  )
    first--;
  while (
    last + 1 < voice.notes.length &&
    voice.notes[last].tieStart &&
    voice.notes[last + 1].tieStop &&
    !voice.notes[last + 1].rest
  )
    last++;
  for (let i = first; i <= last; i++) {
    voice.notes[i].pitch = clone(value);
    voice.notes[i].rest = false;
  }
  return note;
}

export function tieAvailability(score: Score, id: string): string | null {
  const voice = score.voices.find((v) => v.notes.some((n) => n.id === id));
  const index = voice?.notes.findIndex((n) => n.id === id) ?? -1;
  const note = voice?.notes[index],
    next = voice?.notes[index + 1];
  if (!voice || !note) return "Select a note to add a tie.";
  if (voice.locked) return "The given cantus is read-only.";
  if (!next) return "There is no following slot to tie to.";
  if (note.tieStart) return null;
  if (note.rest || next.rest) return "A tie cannot connect to a rest.";
  if (!note.pitch) return "Write a pitch before adding a tie.";
  if (note.time + note.duration !== next.time)
    return "Ties must join adjacent slots.";
  return extendedTieReason(score, voice, index);
}

export function toggleTie(score: Score, id: string) {
  if (tieAvailability(score, id)) return false;
  const voice = score.voices.find(
    (v) => !v.locked && v.notes.some((n) => n.id === id),
  )!;
  const index = voice.notes.findIndex((n) => n.id === id);
  const note = voice.notes[index],
    next = voice.notes[index + 1];
  note.tieStart = !note.tieStart;
  next.tieStop = note.tieStart;
  if (note.tieStart && note.pitch) enterPitch(score, id, note.pitch, null);
  return true;
}
