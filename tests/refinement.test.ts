import { expect, test } from "vitest";
import { clone, pitch, type Score } from "../src/model";
import {
  emptyPattern,
  nextWritingPosition,
  resetLinePattern,
  normalizeTempo,
} from "../src/editor";
import { enterPitch } from "../src/entry";
import { compatiblePitches } from "../src/candidates";
import { check } from "../src/rules";
const fixture = (species = 4): Score => ({
  version: 1,
  id: "refinement",
  title: "Fixture",
  species,
  mode: "Dorian",
  bars: 4,
  voices: [
    {
      id: "cp",
      name: "Counterpoint",
      locked: false,
      species,
      notes: emptyPattern("cp", 4, species),
    },
    {
      id: "cf",
      name: "Cantus",
      locked: true,
      species: 1,
      notes: emptyPattern("cf", 4, 1).map((n) => ({ ...n, pitch: pitch(28) })),
    },
  ],
});

test("next writing position stays in its voice, skips rests and written ties, and never wraps", () => {
  const s = fixture();
  expect(nextWritingPosition(s, "cpn0")?.id).toBe("cpn4");
  enterPitch(s, "cpn4", pitch(35), null);
  expect(nextWritingPosition(s, "cpn4")?.id).toBe("cpn12");
  expect(nextWritingPosition(s, "cpn12")?.id).toBe("cpn12");
  expect(nextWritingPosition(s, "cfn0")).toBeUndefined();
  enterPitch(s, "cpn24", pitch(35), null);
  expect(nextWritingPosition(s, "cpn24")).toBeUndefined();
  expect(s.voices[0].notes.find((n) => n.id === "cpn12")?.pitch).toBeNull();
});
test("catalog reset restores assigned rests and ties ahead of saved solution without touching the score", () => {
  const seed = fixture();
  seed.id = "seed";
  const s = clone(seed);
  s.id = "draft";
  s.path = { studyId: "seed", species: 4, voices: 2, mode: "Dorian" };
  s.solution = clone(s.voices);
  s.solution[0].notes[0].rest = false;
  enterPitch(s, "cpn4", pitch(35), null);
  s.voices[0].notes[1].tieStart = false;
  const before = clone(s),
    reset = resetLinePattern(s, "cpn4", [seed])!;
  expect(reset[0].rest).toBe(true);
  expect(reset[1].tieStart).toBe(true);
  expect(reset[2].tieStop).toBe(true);
  expect(reset.every((n) => n.pitch === null)).toBe(true);
  expect(s).toEqual(before);
  s.voices[0].notes = reset;
  expect(resetLinePattern(s, "cpn4", [seed])).toBeNull();
  expect(s.voices[1]).toEqual(before.voices[1]);
  expect(s.id).toBe("draft");
});
test("saved solution is a reset fallback, locked/missing lines cannot be reset", () => {
  const s = fixture();
  s.solution = clone(s.voices);
  s.solution[0].notes[0].rest = false;
  expect(resetLinePattern(s, "cpn0")![0].rest).toBe(false);
  expect(resetLinePattern(s, "cfn0")).toBeNull();
  expect(resetLinePattern(s, "missing")).toBeNull();
});
test.each([1, 2, 3, 4, 5])(
  "custom species %i resets its original rhythm and remains idempotent",
  (species) => {
    const s = fixture(species),
      original = clone(s.voices[0].notes);
    s.voices[0].notes.forEach((n) => {
      n.pitch = pitch(35);
      n.rest = false;
      n.tieStart = false;
      n.tieStop = false;
    });
    s.voices[0].notes = resetLinePattern(s, s.voices[0].notes[0].id)!;
    expect(s.voices[0].notes).toEqual(original);
    expect(resetLinePattern(s, s.voices[0].notes[0].id)).toBeNull();
  },
);
test("standalone cantus and independent inner voice reset using their assigned species", () => {
  const s = fixture(3);
  s.cantusOnly = true;
  s.voices = s.voices.slice(0, 1);
  expect(resetLinePattern(s, "cpn0")?.map((n) => n.duration)).toEqual([
    8, 8, 8, 8,
  ]);
  const multi = fixture(3);
  multi.voices.push({
    id: "inner",
    name: "Inner",
    locked: false,
    species: 1,
    notes: emptyPattern("inner", 4, 1),
  });
  multi.voices[2].notes[0].pitch = pitch(30);
  expect(resetLinePattern(multi, "innern0")?.map((n) => n.duration)).toEqual([
    8, 8, 8, 8,
  ]);
});
test("next-target candidates agree with committed duration entry and do not replace prior notes", () => {
  const s = fixture(1);
  s.species = 5;
  s.voices[0].species = 5;
  enterPitch(s, "cpn0", pitch(35), null);
  const target = nextWritingPosition(s, "cpn0")!,
    before = clone(s);
  const candidates = compatiblePitches(s, target.id, 4);
  expect(candidates.length).toBeGreaterThan(0);
  for (const p of candidates) {
    const next = clone(s);
    enterPitch(next, target.id, p, 4);
    expect(next.voices[0].notes[0]).toEqual(before.voices[0].notes[0]);
    expect(next.voices[0].notes.find((n) => n.id === target.id)?.duration).toBe(
      4,
    );
    expect(
      check(next).filter(
        (f) =>
          (f.severity === "error" || f.basis === "review") &&
          f.notes.includes(target.id),
      ),
    ).toEqual([]);
  }
  expect(s).toEqual(before);
});
test("tempo normalization allows fast playback and handles boundaries and invalid input", () => {
  expect(
    [0, 30, 300, 400, 999, NaN, Infinity].map((n) => normalizeTempo(n)),
  ).toEqual([30, 30, 300, 400, 400, 88, 88]);
  expect(normalizeTempo(300.6)).toBe(301);
  expect(normalizeTempo(NaN, 120)).toBe(120);
});
