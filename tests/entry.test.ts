import { expect, test } from "vitest";
import { type Score, clone, pitch } from "../src/model";
import {
  entryDuration,
  prepareEntry,
  resizeMeasure,
  restoreSelection,
} from "../src/entry";

function study(): Score {
  return {
    version: 1,
    id: "entry",
    title: "Entry study",
    species: 5,
    mode: "Dorian",
    bars: 3,
    voices: [false, true].map((locked, vi) => ({
      id: `v${vi}`,
      name: `Voice ${vi}`,
      locked,
      notes: [0, 8, 16].map((time) => ({
        id: `v${vi}n${time}`,
        time,
        duration: 8,
        pitch: locked ? pitch(21) : null,
      })),
    })),
  };
}

test.each([4, 2])(
  "duration %s carries into new measures without mutating previews",
  (duration) => {
    const s = study(),
      original = clone(s);
    expect(entryDuration(s, "v0n8", duration)).toBe(duration);
    expect(s).toEqual(original);
    const n = prepareEntry(s, "v0n8", duration)!;
    n.pitch = pitch(28);
    expect(
      s.voices[0].notes
        .filter((n) => n.time >= 8 && n.time < 16)
        .map((n) => n.duration),
    ).toEqual(Array(8 / duration).fill(duration));
    expect(s.voices[1]).toEqual(original.voices[1]);
    expect(s.voices[0].notes[0]).toEqual(original.voices[0].notes[0]);
    expect(entryDuration(s, "v0n16", duration)).toBe(duration);
  },
);

test("dotted rhythms fill the measure exactly and keep their shorter remainder", () => {
  const s = study();
  prepareEntry(s, "v0n8", 3)!.pitch = pitch(28);
  expect(
    s.voices[0].notes
      .filter((n) => n.time >= 8 && n.time < 16)
      .map((n) => [n.time, n.duration]),
  ).toEqual([
    [8, 3],
    [11, 3],
    [14, 2],
  ]);
  expect(entryDuration(s, "v0n14", 3)).toBe(2);
  expect(entryDuration(s, "v0n16", 3)).toBe(3);
});

test.each(["pitch", "rest", "tieStart", "tieStop"] as const)(
  "automatic entry preserves measures containing %s",
  (field) => {
    const s = study();
    resizeMeasure(s.voices[0], s.voices[0].notes[1], 4);
    const protectedNote = s.voices[0].notes.find((n) => n.time === 12)!;
    if (field === "pitch") protectedNote.pitch = pitch(28);
    else protectedNote[field] = true;
    const before = clone(s);
    expect(entryDuration(s, "v0n8", 2)).toBe(4);
    prepareEntry(s, "v0n8", 2);
    expect(s).toEqual(before);
  },
);

test("locked voices, assigned path rhythms, and entry without a preference retain their slots", () => {
  const s = study(),
    original = clone(s);
  expect(prepareEntry(s, "v1n8", 2)).toBeUndefined();
  prepareEntry(s, "v0n8", null);
  expect(s).toEqual(original);
  s.path = { studyId: "path", species: 5, voices: 2, mode: "Dorian" };
  const assigned = clone(s);
  expect(entryDuration(s, "v0n8", 2)).toBe(8);
  prepareEntry(s, "v0n8", 2);
  expect(s).toEqual(assigned);
});

test("entry at an interior blank slot preserves preceding slots and caps duration at the barline", () => {
  const s = study();
  resizeMeasure(s.voices[0], s.voices[0].notes[1], 2);
  const before = clone(s.voices[0].notes.filter((n) => n.time < 12));
  expect(entryDuration(s, "v0n12", 6)).toBe(4);
  const n = prepareEntry(s, "v0n12", 6)!;
  expect(n.duration).toBe(4);
  expect(s.voices[0].notes.filter((n) => n.time < 12)).toEqual(before);
  expect(s.voices[0].notes.at(-1)?.time).toBe(16);
});

test("a chosen rhythm replaces an untouched mixed tail even if its first slot already matches", () => {
  const s = study();
  resizeMeasure(s.voices[0], s.voices[0].notes[1], 2);
  resizeMeasure(
    s.voices[0],
    s.voices[0].notes.find((n) => n.time === 10)!,
    6,
  );
  prepareEntry(s, "v0n8", 2);
  expect(
    s.voices[0].notes
      .filter((n) => n.time >= 8 && n.time < 16)
      .map((n) => n.duration),
  ).toEqual([2, 2, 2, 2]);
});

test("a new duration applies to blank slots after a written note without changing it", () => {
  const s = study();
  prepareEntry(s, "v0n0", 4)!.pitch = pitch(28);
  expect(entryDuration(s, "v0n4", 2)).toBe(2);
  prepareEntry(s, "v0n4", 2)!.pitch = pitch(29);
  expect(s.voices[0].notes.filter((n) => n.time < 8).map((n) => [n.time, n.duration, n.pitch])).toEqual([
    [0, 4, pitch(28)], [4, 2, pitch(29)], [6, 2, null],
  ]);
});

test("undo selection falls back to the restored slot after inserted slots disappear", () => {
  const original = study(),
    edited = clone(original);
  prepareEntry(edited, "v0n8", 2);
  expect(restoreSelection(original, edited, "v0n10")).toBe("v0n8");
  expect(restoreSelection(edited, original, "v0n8")).toBe("v0n8");
});
