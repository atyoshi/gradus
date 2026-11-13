import { test, expect } from "vitest";
import { initialClefs } from "../src/clefs";
import { pitch, type Score } from "../src/model";
const score = (): Score => ({
  version: 1,
  id: "clefs",
  title: "Lower voice",
  species: 4,
  mode: "Dorian",
  bars: 1,
  voices: [
    {
      id: "cf",
      name: "Cantus",
      locked: true,
      notes: [{ id: "cf0", time: 0, duration: 8, pitch: pitch(29) }],
    },
    {
      id: "cp",
      name: "Lower voice",
      locked: false,
      notes: [{ id: "cp0", time: 0, duration: 8, pitch: null }],
    },
  ],
});
test("empty voice below the cantus starts in bass clef", () =>
  expect(initialClefs(score())).toEqual(["treble", "bass"]));
test("source register takes precedence over an incidental draft pitch and matches voices by ID", () => {
  const s = score();
  s.solution = [
    { ...s.voices[1], notes: [{ ...s.voices[1].notes[0], pitch: pitch(22) }] },
  ];
  s.voices[1].notes[0].pitch = pitch(35);
  expect(initialClefs(s)).toEqual(["treble", "bass"]);
});
test("existing written registers and an empty upper voice choose their appropriate clefs", () => {
  const s = score();
  s.voices.reverse();
  expect(initialClefs(s)).toEqual(["treble", "treble"]);
  s.voices[0].notes[0].pitch = pitch(22);
  expect(initialClefs(s)).toEqual(["bass", "treble"]);
});
