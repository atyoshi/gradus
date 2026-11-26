import { test, expect } from "vitest";
import { enterPitch, tieAvailability, toggleTie } from "../src/entry";
import { check } from "../src/rules";
import { emptyPattern } from "../src/editor";
import { pitch, type Score } from "../src/model";
const fixture = (): Score => ({
  version: 1,
  id: "ties",
  title: "Ties",
  species: 4,
  mode: "Dorian",
  bars: 4,
  voices: [
    {
      id: "cp",
      name: "Counterpoint",
      locked: false,
      species: 4,
      notes: emptyPattern("cp", 4, 4).map((n) => ({
        ...n,
        pitch: n.rest ? null : pitch(35),
      })),
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

test.each([1, 3])("three-voice species %i cannot borrow a second-species cadential tie", (species) => {
  const s = fixture();
  const voice = s.voices[0];
  s.voices.splice(1, 0, { ...structuredClone(s.voices[1]), id: "middle", locked: false });
  voice.species = s.species = species;
  voice.notes = emptyPattern("cp", s.bars, species);
  const i = voice.notes.findIndex((n) => n.time === (s.bars - 2) * 8);
  const [before, after] = voice.notes.slice(i - 1, i + 1);
  before.pitch = after.pitch = pitch(35);
  expect(tieAvailability(s, before.id)).not.toBeNull();
  before.tieStart = after.tieStop = true;
  expect(check(s)).toContainEqual(expect.objectContaining({
    rule: "species-tie", severity: "error", notes: [before.id],
  }));
});

test.each([1, 3])("species %i does not let entry create a tie the checker rejects", (species) => {
  const s = fixture();
  const v = s.voices[0];
  v.species = s.species = species;
  v.notes = emptyPattern("cp", s.bars, species);
  const i = v.notes.findIndex((n) => n.time === 8);
  const [first, next] = v.notes.slice(i, i + 2);
  first.pitch = pitch(35);
  const before = structuredClone(s);
  expect(toggleTie(s, first.id)).toBe(false);
  expect(s).toEqual(before);
  // An existing/imported tie is diagnosed, not silently removed by the checker.
  first.tieStart = next.tieStop = true;
  next.pitch = first.pitch;
  const imported = structuredClone(s);
  expect(check(s).some((f) => f.rule === "species-tie" && f.notes.includes(first.id))).toBe(true);
  expect(s).toEqual(imported);
  expect(toggleTie(s, first.id)).toBe(true);
});

// Fux Book II, First Exercise, fourth species: upbeat to the following downbeat.
test("a same-bar fourth-species tie is blocked in entry and cannot satisfy the checker", () => {
  const s = fixture();
  const v = s.voices[0];
  v.notes.forEach((n) => { n.tieStart = n.tieStop = false; });
  const [downbeat, upbeat, nextDownbeat] = v.notes.slice(2, 5);
  const before = structuredClone(s);
  expect(toggleTie(s, downbeat.id)).toBe(false);
  expect(s).toEqual(before);
  downbeat.tieStart = upbeat.tieStop = true;
  expect(check(s)).toContainEqual(expect.objectContaining({
    rule: "suspension-chain", severity: "error",
  }));
  expect(toggleTie(s, downbeat.id)).toBe(true); // Existing invalid tie can be removed.
  expect(toggleTie(s, upbeat.id)).toBe(true);
  expect(nextDownbeat.tieStop).toBe(true);
  expect(check(s).some((f) => f.rule === "suspension-chain")).toBe(false);
});
test("extended ties are blocked from either end without mutation while removal works", () => {
  const s = fixture(),
    before = structuredClone(s);
  expect(tieAvailability(s, "cpn8")).toContain("tied pair");
  expect(toggleTie(s, "cpn8")).toBe(false);
  expect(s).toEqual(before);
  s.voices[0].notes[1].tieStart = false;
  s.voices[0].notes[2].tieStop = false;
  s.voices[0].notes[2].tieStart = true;
  s.voices[0].notes[3].tieStop = true;
  expect(toggleTie(s, "cpn4")).toBe(false);
  expect(toggleTie(s, "cpn8")).toBe(true);
});
test("imported chains remain intact and produce fourth-species findings and florid review", () => {
  const s = fixture();
  s.voices[0].notes[2].tieStart = true;
  s.voices[0].notes[3].tieStop = true;
  const before = structuredClone(s);
  expect(
    check(s).some((f) => f.rule === "extended-tie" && f.severity === "error"),
  ).toBe(true);
  expect(s).toEqual(before);
  s.voices[0].species = 5;
  expect(
    check(s).some(
      (f) => f.rule === "extended-tie" && f.severity === "suggestion",
    ),
  ).toBe(true);
});

test.each([4, 12, 20, 28])(
  "fourth-species entry at time %s automatically prepares a blank downbeat",
  (time) => {
    const s = fixture();
    s.bars = 6;
    s.voices[0].notes = emptyPattern("cp", 6, 2);
    const cf = structuredClone(s.voices[1]);
    const n = enterPitch(s, `cpn${time}`, pitch(35, -1), null)!;
    const next = s.voices[0].notes.find((n) => n.time === time + 4)!;
    expect(n.tieStart).toBe(true);
    expect(next.tieStop).toBe(true);
    expect(next.pitch).toEqual(n.pitch);
    expect(s.voices[1]).toEqual(cf);
    // Removing the tie and then editing its pitch must keep the chosen break.
    expect(toggleTie(s, n.id)).toBe(true);
    enterPitch(s, n.id, pitch(36), null);
    expect(n.tieStart).toBe(false);
    expect(next.pitch).toEqual(pitch(35, -1));
  },
);

test("re-entering an existing upbeat also fills its missing tied downbeat", () => {
  const s = fixture();
  s.voices[0].notes = emptyPattern("cp", 4, 2);
  s.voices[0].notes[3].pitch = pitch(34);
  const note = enterPitch(s, "cpn12", pitch(35), null)!;
  expect(note.tieStart).toBe(true);
  expect(s.voices[0].notes[4].tieStop).toBe(true);
  expect(s.voices[0].notes[4].pitch).toEqual(pitch(35));
});

test.each([
  "written",
  "rest",
  "cadence",
  "chain",
  "second",
  "florid",
  "downbeat",
])("automatic ties preserve %s", (kind) => {
  const s = fixture();
  s.voices[0].notes = emptyPattern("cp", 4, 2);
  const notes = s.voices[0].notes;
  let time = 12;
  if (kind === "written") notes[4].pitch = pitch(34);
  if (kind === "rest") notes[4].rest = true;
  if (kind === "cadence") time = 20;
  if (kind === "chain") {
    notes[2].tieStart = true;
    notes[3].tieStop = true;
  }
  if (kind === "second") s.voices[0].species = 2;
  if (kind === "florid") s.voices[0].species = 5;
  if (kind === "downbeat") time = 8;
  const next = notes.find((n) => n.time === time + 4)!;
  const before = structuredClone(next);
  const n = enterPitch(s, `cpn${time}`, pitch(35), null)!;
  expect(n.tieStart).toBe(false);
  expect(next).toEqual(before);
});
