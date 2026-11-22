import { test, expect } from "vitest";
import { check } from "../src/rules";
import { emptyPattern } from "../src/editor";
import { pitch, type Score } from "../src/model";

// Duration units are eighth notes. See RULES.md and Fux (1725), pp. 56, 62–63, 72.
function score(species: number, voices = 2): Score {
  return { version: 1, id: "rhythm-check", title: "Rhythm check", species, mode: "Dorian", bars: 5,
    voices: Array.from({ length: voices }, (_, i) => ({
      id: `v${i}`, name: `Voice ${i}`, locked: i > 0, species: i ? 1 : species,
      notes: emptyPattern(`v${i}`, 5, i ? 1 : species).map((n) => ({ ...n, pitch: n.rest ? null : pitch(28 + i * 7) })),
    })) };
}
const finding = (s: Score, rule: string, id: string) => check(s).some((f) => f.rule === rule && f.notes.includes(id) && f.severity === "error");

test.each([
  [1, 8, false], [1, 4, true], [1, 2, true], [1, 1, true],
  [2, 4, false], [2, 8, true], [2, 2, true], [2, 1, true],
  [3, 2, false], [3, 8, true], [3, 4, true], [3, 1, true],
  [4, 4, false], [4, 8, false], [4, 2, true], [4, 1, true],
] as const)("species %i: interior value %i has rhythm error %s", (species, duration, error) => {
  const s = score(species);
  s.voices[0].notes.find((n) => n.time === 8)!.duration = duration;
  expect(finding(s, "species-rhythm", "v0n8")).toBe(error);
});

test.each([1, 2, 3, 4])("species %i requires a sounding whole note at the end", (species) => {
  const s = score(species);
  const n = s.voices[0].notes.find((note) => note.time === 32)!;
  expect(finding(s, "final-rhythm", n.id)).toBe(false);
  n.duration = 4;
  expect(finding(s, "final-rhythm", n.id)).toBe(true);
  n.duration = 8;
  n.rest = true;
  expect(finding(s, "final-rhythm", n.id)).toBe(true);
});

test("second species allows a whole penultimate note but not an interior one in two voices", () => {
  const s = score(2);
  s.voices[0].notes.find((n) => n.time === 24)!.duration = 8;
  expect(finding(s, "species-rhythm", "v0n24")).toBe(false);
  s.voices[0].notes.find((n) => n.time === 8)!.duration = 8;
  expect(finding(s, "species-rhythm", "v0n8")).toBe(true);
});

test.each([2, 3])("species %i retains whole-note allowance in fuller textures", (species) => {
  const s = score(species, 3);
  s.voices[0].notes.find((n) => n.time === 8)!.duration = 8;
  expect(finding(s, "species-rhythm", "v0n8")).toBe(false);
});

// Fux pp. 53 and 59–60 distinguish prohibited augmented leaps from minor sixths.
test.each([1, 2, 3, 4])("species %i rejects a melodic tritone without rejecting a minor sixth", (species) => {
  const s = score(species);
  const voice = s.voices[0];
  const i = voice.notes.findIndex((n) => n.time === 8);
  voice.notes[i - 1].rest = false;
  voice.notes[i - 1].pitch = { step: "C", alter: 0, octave: 4 };
  voice.notes[i].tieStop = false;
  voice.notes[i].pitch = { step: "F", alter: 1, octave: 4 };
  expect(finding(s, "melodic-interval", voice.notes[i].id)).toBe(true);
  voice.notes[i].pitch = { step: "A", alter: -1, octave: 4 };
  expect(finding(s, "melodic-interval", voice.notes[i].id)).toBe(false);
});
