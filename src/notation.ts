import { Accidental, Dot, StaveNote } from "vexflow/bravura";
import type { Note, Pitch } from "./model";

export const notationDuration = (value: number) =>
  value === 8 ? "w" : value >= 4 ? "h" : value >= 2 ? "q" : "8";

/** Group consecutive written eighths within each quarter-note beat. */
export function eighthBeamGroups(notes: Note[]): number[][] {
  const groups: number[][] = [];
  let group: number[] = [];
  const flush = () => {
    if (group.length > 1) groups.push(group);
    group = [];
  };
  notes.forEach((note, i) => {
    const previous = notes[group[group.length - 1]];
    if (!note.pitch || note.rest || note.duration !== 1) {
      flush();
      return;
    }
    if (previous && (previous.time + previous.duration !== note.time || Math.floor(previous.time / 2) !== Math.floor(note.time / 2))) flush();
    group.push(i);
  });
  flush();
  return groups;
}

/** Shared engraving for committed notes and the placement preview. */
export function engravedNote(
  p: Pitch,
  value: number,
  clef: string,
  rest = false,
  previousAlter = 0,
) {
  const note = new StaveNote({
    clef,
    // VexFlow's neutral rest key places whole rests on line four and
    // other rests on line three, independently of the clef or draft pitch.
    keys: rest ? ["r/4"] : [`${p.step.toLowerCase()}/${p.octave}`],
    duration: notationDuration(value) + (rest ? "r" : ""),
  });
  if (!rest && (p.alter || previousAlter !== p.alter))
    note.addModifier(
      new Accidental(
        p.alter === 1
          ? "#"
          : p.alter === -1
            ? "b"
            : p.alter === 2
              ? "##"
              : p.alter === -2
                ? "bb"
                : "n",
      ),
    );
  if ([6, 3, 1.5].includes(value)) Dot.buildAndAttach([note], { all: true });
  return note;
}
