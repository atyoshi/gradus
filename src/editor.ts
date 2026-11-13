import { assignedSpecies, clone, type Note, type Score } from "./model";

export const MIN_TEMPO = 30;
export const MAX_TEMPO = 400;
export function normalizeTempo(value: number, fallback = 88) {
  return Number.isFinite(value)
    ? Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(value)))
    : fallback;
}

/** Empty rhythm shared by custom exercise creation and Clear line. */
export function emptyPattern(
  voiceId: string,
  bars: number,
  species: number,
): Note[] {
  const notes: Note[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const rhythm =
      bar === bars - 1 || species === 1
        ? [8]
        : species === 3
          ? [2, 2, 2, 2]
          : species === 5 && bar % 2 === 1
            ? [2, 2, 4]
            : [4, 4];
    let time = bar * 8;
    rhythm.forEach((duration, k) => {
      notes.push({
        id: `${voiceId}n${time}`,
        time,
        duration,
        pitch: null,
        rest: species === 4 && bar === 0 && k === 0,
        tieStop: species === 4 && bar > 0 && bar < bars - 1 && k === 0,
        tieStart: species === 4 && bar < bars - 2 && k === 1,
      });
      time += duration;
    });
  }
  return notes;
}

export function nextWritingPosition(
  score: Score,
  selected: string,
): Note | undefined {
  const voice = score.voices.find(
    (v) => !v.locked && v.notes.some((n) => n.id === selected),
  );
  if (!voice) return;
  const index = voice.notes.findIndex((n) => n.id === selected);
  return voice.notes.slice(index).find((n) => !n.pitch && !n.rest);
}

export function resetLinePattern(
  score: Score,
  selected: string,
  catalog: Score[] = [],
): Note[] | null {
  const voice = score.voices.find(
    (v) => !v.locked && v.notes.some((n) => n.id === selected),
  );
  if (!voice) return null;
  const seed = catalog.find(
    (c) =>
      c.id === score.path?.studyId ||
      c.id === score.source?.exerciseId ||
      (c.title === score.title &&
        !!c.source?.url &&
        c.source.url === score.source?.url),
  );
  const original =
    seed?.voices.find((v) => v.id === voice.id) ||
    score.solution?.find((v) => v.id === voice.id);
  const notes = original
    ? clone(original.notes).map((n) => ({ ...n, pitch: null }))
    : emptyPattern(
        voice.id,
        score.bars,
        score.cantusOnly ? 1 : assignedSpecies(score, voice),
      );
  // IDs and omitted false flags aren't musical changes; retain matching IDs for selection/history.
  for (const n of notes)
    n.id = voice.notes.find((old) => old.time === n.time)?.id || n.id;
  const shape = (ns: Note[]) =>
    ns.map((n) => [
      n.time,
      n.duration,
      n.pitch,
      !!n.rest,
      !!n.tieStart,
      !!n.tieStop,
    ]);
  return JSON.stringify(shape(notes)) === JSON.stringify(shape(voice.notes))
    ? null
    : notes;
}
