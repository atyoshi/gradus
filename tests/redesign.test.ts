import { test, expect } from "vitest";
import { enterPitch, toggleTie, tieAvailability } from "../src/entry";
import { analyze } from "../src/analysis";
import { compatiblePitches } from "../src/candidates";
import { check } from "../src/rules";
import { violationText } from "../src/feedback";
import { clone, pitch, type Score, type Finding } from "../src/model";
import { exportXML, importXML } from "../src/musicxml";

function fixture(): Score {
  return {
    version: 1,
    id: "redesign",
    title: "Suspension",
    species: 4,
    mode: "Dorian",
    bars: 4,
    path: { studyId: "suspension", species: 4, voices: 2, mode: "Dorian" },
    voices: [
      {
        id: "cp",
        name: "Counterpoint",
        locked: false,
        species: 4,
        notes: [35, 36, 36, 35, 34, 33, 32].map((d, i) => ({
          id: `cp${i}`,
          time: i * 4,
          duration: i === 6 ? 8 : 4,
          pitch: pitch(d),
        })),
      },
      {
        id: "cf",
        name: "Cantus",
        locked: true,
        species: 1,
        notes: [31, 30, 29, 28].map((d, i) => ({
          id: `cf${i}`,
          time: i * 8,
          duration: 8,
          pitch: pitch(d),
        })),
      },
    ],
  };
}
test("guided ties preserve note lengths, support chain entry from either end and removal without pitch loss", () => {
  const s = fixture(),
    old = clone(s);
  expect(toggleTie(s, "cp1")).toBe(true);
  expect(s.voices[0].notes[1].tieStart).toBe(true);
  expect(s.voices[0].notes[2].tieStop).toBe(true);
  enterPitch(s, "cp2", pitch(37, -1), 2);
  expect(s.voices[0].notes.slice(1, 3).map((n) => n.pitch)).toEqual([
    pitch(37, -1),
    pitch(37, -1),
  ]);
  expect(s.voices[0].notes.map((n) => n.duration)).toEqual(
    old.voices[0].notes.map((n) => n.duration),
  );
  const values = s.voices[0].notes.map((n) => n.pitch);
  expect(toggleTie(s, "cp1")).toBe(true);
  expect(s.voices[0].notes[2].tieStop).toBe(false);
  expect(s.voices[0].notes.map((n) => n.pitch)).toEqual(values);
  expect(s.voices[1]).toEqual(old.voices[1]);
});
test("ties explain empty, rest, locked and final slot cases without mutations", () => {
  const s = fixture();
  expect(tieAvailability(s, "cf0")).toContain("read-only");
  expect(tieAvailability(s, "cp6")).toContain("no following");
  s.voices[0].notes[1].rest = true;
  const old = clone(s);
  expect(tieAvailability(s, "cp0")).toContain("rest");
  expect(toggleTie(s, "cp0")).toBe(false);
  expect(s).toEqual(old);
  s.voices[0].notes[1].rest = false;
  s.voices[0].notes[0].pitch = null;
  expect(tieAvailability(s, "cp0")).toContain("Write a pitch");
});
test("edited ties round trip through MusicXML", () => {
  const s = fixture();
  toggleTie(s, "cp1");
  enterPitch(s, "cp2", pitch(36), null);
  const result = importXML(
    new TextEncoder().encode(exportXML(s)),
    "score.musicxml",
    s.species,
    s.mode,
  );
  expect(
    result.voices[0].notes
      .slice(1, 3)
      .map((n) => [n.pitch, !!n.tieStart, !!n.tieStop]),
  ).toEqual(
    s.voices[0].notes
      .slice(1, 3)
      .map((n) => [n.pitch, !!n.tieStart, !!n.tieStop]),
  );
});
test("compatible candidates evaluate the full committed tied change without editing the original", () => {
  const s = fixture();
  toggleTie(s, "cp1");
  s.voices[0].notes.slice(3).forEach((n) => (n.pitch = null));
  const old = clone(s),
    candidates = compatiblePitches(s, "cp1", null);
  expect(s).toEqual(old);
  expect(candidates.length).toBeGreaterThan(0);
  for (const candidate of candidates) {
    const next = clone(s);
    enterPitch(next, "cp1", candidate, null);
    expect(next.voices[0].notes[2].pitch).toEqual(candidate);
    expect(
      check(next).filter(
        (f) =>
          (f.severity === "error" || f.basis === "review") &&
          f.notes.some((id) => ["cp1", "cp2"].includes(id)),
      ),
    ).toEqual([]);
  }
});
function melody(): Score {
  const s = fixture();
  s.species = 1;
  s.path = undefined;
  s.voices[0].species = 1;
  s.voices[0].notes = [35, 37, 36, 36].map((d, i) => ({
    id: `n${i}`,
    time: i * 8,
    duration: 8,
    pitch: pitch(d),
  }));
  s.voices[1].notes.forEach((n, i) => (n.pitch = pitch([28, 27, 28, 29][i])));
  return s;
}
test("analysis uses moving attacks, repeated attacks and independently specified downbeat comparisons", () => {
  const a = analyze(melody(), "n0", []);
  expect(a).toMatchObject({
    steps: 1,
    leaps: 1,
    repeats: 1,
    stepPercent: 50,
    range: 3,
    recovered: 1,
    contrary: 2,
    oblique: 1,
    similar: 0,
    intervals: 4,
  });
  expect(a.highBars).toEqual([2]);
});
test("analysis does not bridge rests, blanks or count tied continuations as attacks", () => {
  const s = melody();
  s.voices[0].notes[1].rest = true;
  const a = analyze(s, "n0", []);
  expect(a).toMatchObject({
    comparedAttacks: 1,
    leaps: 0,
    repeats: 1,
    contrary: 0,
  });
  s.voices[0].notes[1].rest = false;
  s.voices[0].notes[1].pitch = null;
  expect(analyze(s, "n0", []).partial).toBe(true);
  s.voices[0].notes[1].pitch = pitch(35);
  // Analysis must still recognize an existing tie even when entry would reject it.
  s.voices[0].notes[0].tieStart = true;
  s.voices[0].notes[1].tieStop = true;
  expect(analyze(s, "n0", []).comparedAttacks).toBe(2);
});
test("unrelated violations do not hide a recovered leap strength", () => {
  const f: Finding = {
    rule: "other",
    severity: "error",
    notes: ["n3"],
    message: "Other error",
    source: "Fixture",
  };
  expect(
    analyze(melody(), "n0", [f]).strengths.some(
      (s) => s.title === "Leap answered by step",
    ),
  ).toBe(true);
  expect(
    analyze(melody(), "n0", [
      { ...f, rule: "melodic-interval", notes: ["n1"] },
    ]).strengths.some((s) => s.title === "Leap answered by step"),
  ).toBe(false);
});
test("analysis selects an editable voice and omits unknown ranges and step percentages", () => {
  const s = melody();
  const other = clone(s.voices[0]);
  other.id = "other";
  other.name = "Other voice";
  other.notes.forEach((n) => {
    n.id = "other" + n.id;
    n.pitch = null;
  });
  s.voices.push(other);
  const a = analyze(s, "othern0", []);
  expect(a.voice).toBe("Other voice");
  expect(a.range).toBeUndefined();
  expect(a.stepPercent).toBeUndefined();
  expect(analyze(s, "cf0", []).voice).toBe("Counterpoint");
});
test("species four diagnostic wording distinguishes attacks and incorrect resolution", () => {
  const s = fixture();
  const f: Finding = {
    rule: "dissonance",
    severity: "error",
    notes: ["cp2", "cf1"],
    message: "Generic",
    source: "Fixture",
  };
  expect(violationText(s, f)).toContain("without a prepared tie");
  toggleTie(s, "cp1");
  s.voices[0].notes[3].pitch = pitch(37);
  expect(violationText(s, f)).toContain("does not resolve down by step");
  expect(violationText(s, { ...f, notes: ["cp3", "cf1"] })).toContain(
    "weak-half dissonance",
  );
});

test("chromatic pitch changes are not repeated attacks and the highest pitch respects accidentals", () => {
  const s = melody();
  s.voices[0].notes = [pitch(35), pitch(35, 1), pitch(35)].map((p, i) => ({
    id: `c${i}`,
    time: i * 8,
    duration: 8,
    pitch: p,
  }));
  const result = analyze(s, "c0", []);
  expect(result.repeats).toBe(0);
  expect(result.steps).toBe(2);
  expect(result.high).toBe("C♯5");
  expect(result.highBars).toEqual([2]);
});
