import { crossesBarline, extendedTieReason, permitsSpeciesTie } from "./ties";
import { isClosingBar, permitsRest } from "./rhythm";
import {
  type Score,
  type Voice,
  type Note,
  type Pitch,
  clone,
  assignedSpecies,
  clearSecondSpeciesTies,
} from "./model";

const entryValues = [8, 6, 4, 3, 2, 1];
const occupied = (note: Note) => note.pitch || note.rest || note.tieStart || note.tieStop;

function blankSpanEnd(voice: Voice, note: Note) {
  const barEnd = (Math.floor(note.time / 8) + 1) * 8;
  const nextWritten = voice.notes.find((n) => n.time > note.time && occupied(n));
  return Math.min(barEnd, nextWritten?.time ?? barEnd);
}

function entrySlot(score: Score, id: string) {
  const voice = score.voices.find((v) => v.notes.some((n) => n.id === id));
  return { voice, note: voice?.notes.find((n) => n.id === id) };
}

export function editableRhythm(score: Score, id: string) {
  const { voice, note } = entrySlot(score, id);
  return !!voice && !!note && !voice.locked && assignedSpecies(score, voice) === 5 &&
    !isClosingBar(score, note);
}

/** Only florid voices offer a rhythm choice. Other voices retain the exercise's slots. */
export function allowedEntryDurations(score: Score, id: string): number[] {
  const { voice, note } = entrySlot(score, id);
  if (!voice || !note || voice.locked) return [];
  return editableRhythm(score, id) ? [...entryValues].reverse() : [note.duration];
}

// Reflow only the blank span, stopping at the next written event or barline.
export function resizeMeasure(v: Voice, note: Note, duration: number) {
  const end = blankSpanEnd(v, note);
  if (duration <= 0 || note.time + duration > end)
    throw Error("The note would extend beyond this bar.");
  const notes = [{ ...note, duration, tieStart: false, tieStop: false }];
  for (let time = note.time + duration; time < end - 1e-9;) {
    const length = entryValues.find((value) => value <= duration && value <= end - time) ?? end - time;
    notes.push({
      id: v.notes.find((n) => n.time === time)?.id ?? `${v.id}n${time}`,
      time,
      duration: length,
      pitch: null,
      rest: false,
      tieStart: false,
      tieStop: false,
    });
    time += length;
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
  return preferred !== null &&
    editableRhythm(score, id) &&
    !occupied(note)
    ? entryValues.find((duration) => duration <= preferred && duration <= blankSpanEnd(voice, note) - note.time) ?? note.duration
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
  clearSecondSpeciesTies(score, voice);
  const duration = entryDuration(score, id, preferred);
  if (preferred !== null && editableRhythm(score, id) && !occupied(note) &&
      note.time + duration <= blankSpanEnd(voice, note))
    resizeMeasure(voice, note, duration);
  return voice.notes.find((n) => n.id === id);
}

export function restAvailability(score: Score, id: string): string | null {
  const { voice, note } = entrySlot(score, id);
  if (!voice || !note) return "Select a note to enter a rest.";
  if (voice.locked) return "The given cantus is read-only.";
  if (score.path && assignedSpecies(score, voice) !== 5) return "This study keeps its assigned rests.";
  if (note.rest) return null;
  if (isClosingBar(score, note)) return "Close the exercise with a sounding whole note.";
  if (!permitsRest(score, voice, note)) return "A rest is not available at this position in this species.";
  if (note.tieStart || note.tieStop) return "Remove the tie before entering a rest.";
  return null;
}

export function toggleRest(score: Score, id: string, preferred: number | null) {
  if (restAvailability(score, id)) return false;
  const note = prepareEntry(score, id, preferred);
  if (!note) return false;
  note.rest = !note.rest;
  note.pitch = null;
  return true;
}

export function enterFloridRest(score: Score, id: string, preferred: number | null) {
  if (!editableRhythm(score, id) || restAvailability(score, id)) return false;
  const note = prepareEntry(score, id, preferred);
  if (!note) return false;
  note.rest = true;
  note.pitch = null;
  return true;
}

/** Advance past the attack just entered (including its tied continuations). */
export function nextFloridAttack(score: Score, id: string) {
  const { voice, note } = entrySlot(score, id);
  if (!voice || !note) return id;
  let index = voice.notes.indexOf(note);
  while (voice.notes[index].tieStart && voice.notes[index + 1]?.tieStop &&
      !voice.notes[index + 1].rest &&
      voice.notes[index].time + voice.notes[index].duration === voice.notes[index + 1].time)
    index++;
  return voice.notes[index + 1]?.id ?? id;
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
  if (assignedSpecies(score, voice) === 2) return "Ties are not available in second species.";
  if (!next) return "There is no following slot to tie to.";
  if (note.tieStart) return null;
  if (!permitsSpeciesTie(score, voice, note))
    return "Tied syncopations belong to fourth or fifth species.";
  if (note.rest || next.rest) return "A tie cannot connect to a rest.";
  if (!note.pitch) return "Write a pitch before adding a tie.";
  if (note.time + note.duration !== next.time)
    return "Ties must join adjacent slots.";
  return extendedTieReason(score, voice, index) ??
    (assignedSpecies(score, voice) === 4 && !crossesBarline(note, next)
      ? "Fourth-species suspensions tie an upbeat to the following downbeat."
      : null);
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
