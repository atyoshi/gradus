import { expect, test } from "vitest";
import { check } from "../src/rules";
import { type Score, type Pitch } from "../src/model";

const p = (name: string): Pitch => ({
  step: name[0] as Pitch["step"],
  octave: Number(name[1]),
  alter: 0,
});
function suspension(lower = false, species = 4): Score {
  const lines = lower
    ? [
        ["C4", "C4", "C4", "C4", "C4"],
        ["A3", "A3", "A3", "A3", "A3"],
        ["F3", "D3", "D3", "C3", "C3"],
      ]
    : [
        ["F4", "F4", "F4", "E4", "C4"],
        ["C4", "C4", "G3", "G3", "G3"],
        ["F3", "F3", "C3", "C3", "C3"],
      ];
  return {
    version: 1,
    id: "sonority",
    title: "Suspended sonority",
    mode: "Ionian",
    bars: 3,
    species,
    voices: lines.map((line, vi) => ({
      id: `v${vi}`,
      name: `Voice ${vi}`,
      locked: false,
      species: vi === (lower ? 2 : 0) ? species : 1,
      notes: line.map((name, i) => ({
        id: `v${vi}n${i * 4}`,
        time: i * 4,
        duration: i === 4 ? 8 : 4,
        pitch: p(name),
        tieStart: vi === (lower ? 2 : 0) && i === 1,
        tieStop: vi === (lower ? 2 : 0) && i === 2,
      })),
    })),
  };
}
const fullness = (s: Score) =>
  check(s).filter((f) => f.rule === "full-sonority");

test.each([4, 5])(
  "a prepared upper suspension in species %s does not need a full downbeat sonority",
  (species) => {
    const s = suspension(false, species);
    expect(fullness(s)).toEqual([]);
    expect(check(s).filter((f) => f.rule === "dissonance")).toEqual([]);
    s.voices[0].notes[3].pitch = null;
    expect(fullness(s)).toEqual([]);
  },
);

test("a bass suspension is not graded as an incomplete chord", () => {
  expect(fullness(suspension(true))).toEqual([]);
});

test("invalid suspensions retain dissonance feedback without contradictory fullness advice", () => {
  const s = suspension();
  s.voices[0].notes[3].pitch = p("G4");
  expect(fullness(s)).toEqual([]);
  expect(check(s).some((f) => f.rule === "dissonance")).toBe(true);
});

test("consonant fifths and octaves still receive fullness advice, while thirds do not", () => {
  const s = suspension();
  for (const n of s.voices[0].notes) {
    n.pitch = p("C4");
    n.tieStart = false;
    n.tieStop = false;
  }
  expect(fullness(s)).toHaveLength(1);
  expect(fullness(s)[0].notes).toEqual(["v0n8", "v1n8", "v2n8"]);
  s.voices[0].notes[2].pitch = p("E4");
  expect(fullness(s)).toEqual([]);
});
