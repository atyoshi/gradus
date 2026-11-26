import { expect, test } from "vitest";
import { allowedEntryDurations, enterPitch, entryDuration } from "../src/entry";
import { emptyPattern } from "../src/editor";
import { clone, pitch, type Score } from "../src/model";
import { check } from "../src/rules";

function fixture(species: number, voices = 2): Score {
  return {
    version: 1, id: `rhythm-${species}-${voices}`, title: "Rhythm", species,
    mode: "Dorian", bars: 5,
    voices: Array.from({ length: voices }, (_, i) => ({
      id: `v${i}`, name: `Voice ${i}`, locked: i > 0,
      species: i ? 1 : species,
      notes: emptyPattern(`v${i}`, 5, i ? 1 : species),
    })),
  };
}

test("first-species entry cannot change an empty whole note into a quarter", () => {
  const s = fixture(1);
  enterPitch(s, "v0n8", pitch(35), 2);
  expect(s.voices[0].notes.find((n) => n.id === "v0n8")!.duration).toBe(8);
  expect(s.voices[0].notes.filter((n) => n.time >= 8 && n.time < 16)).toHaveLength(1);
});

test.each([
  [1, 2, [8]], [2, 2, [4]], [3, 2, [2]], [4, 2, [4]],
  [1, 3, [8]], [2, 3, [4]], [3, 3, [2]], [4, 3, [4]],
] as const)("species %i with %i voices permits only appropriate interior durations", (species, voices, expected) => {
  const s = fixture(species, voices);
  expect(allowedEntryDurations(s, "v0n8")).toEqual(expected);
  for (const invalid of [1, 2, 3, 4, 6, 8].filter((n) => !expected.includes(n as never))) {
    const draft = clone(s);
    const before = clone(draft);
    expect(entryDuration(draft, "v0n8", invalid)).toBe(before.voices[0].notes.find((n) => n.id === "v0n8")!.duration);
    expect(draft).toEqual(before);
    enterPitch(draft, "v0n8", pitch(35), invalid);
    expect(draft.voices[0].notes.find((n) => n.id === "v0n8")!.duration).toBe(before.voices[0].notes.find((n) => n.id === "v0n8")!.duration);
  }
});

test.each([1, 2, 3, 4])("species %i final measure only accepts a whole note", (species) => {
  const s = fixture(species);
  expect(allowedEntryDurations(s, "v0n32")).toEqual([8]);
});

test("second species keeps the penultimate rhythm as assigned", () => {
  expect(allowedEntryDurations(fixture(2), "v0n24")).toEqual([4]);
});

test("fourth-species selections cannot cross the barline", () => {
  expect(allowedEntryDurations(fixture(4), "v0n12")).toEqual([4]);
});

test("florid entry retains the full notatable duration range", () => {
  expect(allowedEntryDurations(fixture(5), "v0n8")).toEqual([1, 2, 3, 4, 6, 8]);
});

test("florid entry cannot shorten the closing whole note", () => {
  const s = fixture(5);
  expect(allowedEntryDurations(s, "v0n32")).toEqual([8]);
  for (const preferred of [1, 2, 3, 4, 6, 8]) {
    const draft = clone(s);
    expect(entryDuration(draft, "v0n32", preferred)).toBe(8);
    enterPitch(draft, "v0n32", pitch(35), preferred);
    expect(draft.voices[0].notes.filter((n) => n.time >= 32)).toMatchObject([
      { time: 32, duration: 8, pitch: pitch(35) },
    ]);
  }
});

test("a first-species voice remains fixed within a mixed florid exercise", () => {
  const s = fixture(5, 3);
  s.voices[0].species = 1;
  s.voices[0].notes = emptyPattern("v0", 5, 1);
  expect(allowedEntryDurations(s, "v0n8")).toEqual([8]);
  enterPitch(s, "v0n8", pitch(35), 2);
  expect(s.voices[0].notes.find((n) => n.id === "v0n8")!.duration).toBe(8);
});

test.each([2, 3, 4])("species %i checks the rhythm of tied continuations", (species) => {
  const s = fixture(species);
  const voice = s.voices[0];
  const index = voice.notes.findIndex((n) => n.time === 8);
  const previous = voice.notes[index - 1];
  const note = voice.notes[index];
  previous.pitch = pitch(35);
  previous.tieStart = true;
  note.pitch = pitch(35);
  note.tieStop = true;
  note.duration = 1;
  expect(check(s).some((f) => f.rule === "species-rhythm" && f.notes.includes(note.id))).toBe(true);
});
