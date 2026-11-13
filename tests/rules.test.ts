import { test, expect } from "vitest";
import fs from "node:fs";
import { check, consonant } from "../src/rules";
import {
  type Score,
  type Note,
  type Pitch,
  parseKern,
  clone,
  blank,
  complete,
} from "../src/model";
import {
  catalogue,
  fresh,
  solve,
  fromCantus,
  cantusKey,
} from "../src/exercises";
import { exportXML, importXML } from "../src/musicxml";
import { findingBars, measureFeedback } from "../src/feedback";
const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
const source = (id = "gap_005") =>
  parseKern(rows.find((x: any) => x.metadata.id === id));
const n = (step: string, octave = 4, alter = 0): Note => ({
  id: step + octave,
  time: 0,
  duration: 8,
  pitch: { step, octave, alter },
});
const errors = (s: Score) => check(s).filter((f) => f.severity === "error");
test("fourths depend on bass position; compound intervals and spelled tritones", () => {
  expect(consonant(n("C"), n("F"))).toBe(false);
  expect(consonant(n("C"), n("F"), true)).toBe(true);
  expect(consonant(n("C"), n("E", 5))).toBe(true);
  expect(consonant(n("F"), n("B"))).toBe(false);
  expect(consonant(n("C"), n("E", 4, 1))).toBe(false);
});
test("opening Fux example and source pitches are intact", () => {
  const s = source();
  expect(s.bars).toBe(11);
  expect(s.voices[1].notes.map((n) => n.pitch?.step).join("")).toBe(
    "DFEDG FAGFED".replaceAll(" ", ""),
  );
  expect(errors(s)).toEqual([]);
  expect(s.voices[0].notes.at(-2)?.pitch?.alter).toBe(1);
});
test("suspension tokens retain onsets, ties, and rests", () => {
  const s = source("gap_073");
  expect(s.bars).toBe(11);
  expect(s.voices[0].notes[0].rest).toBe(true);
  expect(s.voices[0].notes[1].tieStart).toBe(true);
  expect(s.voices[0].notes[2].tieStop).toBe(true);
  expect(s.voices[0].notes[2].time).toBe(8);
  expect(errors(s)).toEqual([]);
});
test("ornamental suspension resolution is allowed", () => {
  expect(errors(source("gap_082"))).toEqual([]);
  expect(errors(source("gap_200"))).toEqual([]);
});
test("three-voice source suspension studies do not receive full-sonority penalties", () => {
  for (const id of [
    "gap_141",
    "gap_143",
    "gap_144",
    "gap_146",
    "gap_147",
    "gap_148",
    "gap_149",
    "gap_150",
    "gap_151",
  ])
    expect(
      check(source(id)).filter((f) => f.rule === "full-sonority"),
      id,
    ).toEqual([]);
});
test("parallel fifths and octaves are found between any two voices", () => {
  for (const voices of [2, 3, 4]) {
    const s: Score = {
      ...source(),
      bars: 2,
      voices: Array.from({ length: voices }, (_, i) => ({
        id: `v${i}`,
        name: `V${i}`,
        locked: i === voices - 1,
        notes: [
          {
            ...n(i === voices - 1 ? "C" : "G", i === voices - 1 ? 3 : 4),
            id: `v${i}n0`,
          },
          {
            ...n(i === voices - 1 ? "D" : "A", i === voices - 1 ? 3 : 4),
            id: `v${i}n8`,
            time: 8,
          },
        ],
      })),
    };
    expect(errors(s).some((f) => f.rule === "parallels")).toBe(true);
  }
});
test("incomplete neighbors defer dissonance judgments", () => {
  const s = blank(source("gap_033"));
  const cp = s.voices.find((v) => !v.locked)!;
  cp.notes[1].pitch = { step: "E", octave: 4, alter: 0 };
  expect(errors(s).filter((f) => f.rule === "dissonance")).toEqual([]);
  expect(complete(s)).toBe(false);
});
test("tie mismatch and raised leading tone are independently detected", () => {
  const s = source("gap_073");
  s.voices[0].notes[2].pitch = { step: "B", octave: 4, alter: 0 };
  expect(errors(s).some((f) => f.rule === "tie")).toBe(true);
  const c = source();
  c.voices[0].notes.at(-2)!.pitch!.alter = 0;
  expect(errors(c).some((f) => f.rule === "leading-tone")).toBe(true);
});
test("invalid melodic spelling and leaps are marked", () => {
  const s = source();
  s.voices[0].notes[1].pitch = { step: "B", octave: 5, alter: 0 };
  expect(errors(s).some((f) => f.rule === "melodic-interval")).toBe(true);
});
test("all source examples have complete timelines and valid tie structure", () => {
  for (const row of rows) {
    const s = parseKern(row);
    for (const v of s.voices) {
      let time = 0;
      for (const n of v.notes) {
        expect(n.time).toBe(time);
        time += n.duration;
      }
      expect(time).toBe(s.bars * 8);
    }
    expect(errors(s).filter((f) => f.rule === "tie")).toEqual([]);
  }
});
test("48 checked templates cover three per species and voice count plus cantus", () => {
  const practice: Score[] = JSON.parse(
    fs.readFileSync("public/sources/practice.json", "utf8"),
  );
  expect(practice).toHaveLength(48);
  for (const v of [2, 3, 4])
    for (const species of [1, 2, 3, 4, 5])
      expect(
        practice.filter((s) => s.voices.length === v && s.species === species),
      ).toHaveLength(3);
  for (const s of practice) {
    expect(complete(s)).toBe(true);
    expect(errors(s)).toEqual([]);
  }
});
test("generation retains a checked solution and leaves seeds unchanged", () => {
  const s = source();
  const before = JSON.stringify(s);
  const generated = fresh(s);
  expect(JSON.stringify(s)).toBe(before);
  expect(complete(generated)).toBe(false);
  expect(generated.solution).toBeTruthy();
  expect(generated.generated).toBe(true);
  expect(cantusKey(generated)).not.toBe(cantusKey(s));
  expect(errors({ ...generated, voices: generated.solution! })).toEqual([]);
}, 15000);
test("generation reports failure instead of returning an unchanged cantus", () => {
  const s = source();
  s.voices.forEach((v) => {
    v.notes = v.notes.slice(0, 2);
  });
  const before = JSON.stringify(s);
  expect(() => fresh(s)).toThrow("No different, solvable cantus was found");
  expect(JSON.stringify(s)).toBe(before);
});
test("hints solve while retaining the notes already entered", () => {
  const s = blank(source());
  s.voices[0].notes[0].pitch = source().voices[0].notes[0].pitch;
  const answer = solve(s, s.solution, 1200);
  expect(answer).toBeTruthy();
  expect(answer![0].notes[0].pitch).toEqual(s.voices[0].notes[0].pitch);
});
test("MusicXML round trips every source pitch, time, rest, and tie", () => {
  for (const row of rows) {
    const s = parseKern(row);
    const xml = exportXML(s);
    const got = importXML(
      new TextEncoder().encode(xml),
      "score.musicxml",
      s.species,
      s.mode,
    );
    const normalized = (s: Score) =>
      s.voices.map((v) =>
        v.notes.map((n) => ({
          time: n.time,
          duration: n.duration,
          pitch: n.pitch,
          rest: !!n.rest,
          tieStart: !!n.tieStart,
          tieStop: !!n.tieStop,
        })),
      );
    expect(normalized(got)).toEqual(normalized(s));
  }
});
test("unsupported XML is rejected explicitly", () => {
  const xml = exportXML(source());
  for (const bad of [
    xml.replace("<note>", "<note><chord/>"),
    xml.replace("<duration>8</duration>", "<duration>7</duration>"),
    xml.replace(
      '<measure number="1">',
      '<measure number="1"><backup><duration>8</duration></backup>',
    ),
  ])
    expect(() =>
      importXML(new TextEncoder().encode(bad), "bad.xml", 1, "Dorian"),
    ).toThrow();
});
test("new modal, species-rhythm, and sonority feedback has explicit severity", () => {
  const s = source();
  s.voices[0].notes[2].pitch = { step: "F", octave: 4, alter: 1 };
  expect(check(s).find((f) => f.rule === "mode")?.basis).toBe("review");
  s.voices[0].notes[0].duration = 4;
  expect(errors(s).some((f) => f.rule === "species-rhythm")).toBe(true);
});

test("single-part cantus imports create independent, empty counterpoint voices", () => {
  const original = source();
  const input = { ...original, voices: [original.voices[1]] };
  for (const species of [1, 2, 3, 4, 5]) {
    const s = fromCantus(input, species, 4);
    expect(s.voices).toHaveLength(4);
    expect(s.voices.filter((v) => v.locked)).toHaveLength(1);
    expect(
      s.voices
        .filter((v) => !v.locked)
        .flatMap((v) => v.notes)
        .every((n) => !n.pitch),
    ).toBe(true);
    expect(
      s.voices.every(
        (v) => v.notes.at(-1)!.time + v.notes.at(-1)!.duration === s.bars * 8,
      ),
    ).toBe(true);
  }
});

test("first-species repetition is advice, including the corrected historical figure", () => {
  const s = source();
  const v = s.voices[0];
  v.notes[2].pitch = clone(v.notes[1].pitch);
  expect(check(s).find((f) => f.rule === "repetition")?.severity).toBe(
    "suggestion",
  );
  expect(errors(source("gap_015"))).toEqual([]);
  expect(errors(source()).some((f) => f.rule === "repetition")).toBe(false);
});
test("two-voice higher species rejects repeated attacks but preserves tied continuations", () => {
  const s = source("gap_033");
  const v = s.voices.find((v) => !v.locked)!;
  v.notes[2].pitch = clone(v.notes[1].pitch);
  expect(errors(s).some((f) => f.rule === "repetition")).toBe(true);
  expect(errors(source("gap_073")).some((f) => f.rule === "repetition")).toBe(
    false,
  );
});
test("strict direct perfects include an upper voice moving by step", () => {
  const s = source();
  s.voices[0].notes[0].pitch = { step: "G", octave: 4, alter: 0 };
  s.voices[1].notes[0].pitch = { step: "E", octave: 4, alter: 0 };
  s.voices[0].notes[1].pitch = { step: "A", octave: 4, alter: 0 };
  s.voices[1].notes[1].pitch = { step: "D", octave: 4, alter: 0 }; // contrary motion allowed
  expect(
    errors(s).some(
      (f) => f.rule === "direct-perfect" && f.notes.includes("v1n8"),
    ),
  ).toBe(false);
  s.voices[1].notes[0].pitch = { step: "B", octave: 3, alter: 0 };
  expect(
    errors(s).some(
      (f) => f.rule === "direct-perfect" && f.notes.includes("v1n8"),
    ),
  ).toBe(true);
});
test("three-voice direct perfects flag both stepwise and leaping approaches across bars 4–6", () => {
  const s: Score = {
    version: 1,
    id: "direct-perfect-review",
    title: "Three-voice review",
    species: 1,
    mode: "Dorian",
    bars: 7,
    voices: [
      [n("F", 5), n("G", 5), n("C", 5)],
      [n("D", 4), n("G", 4), n("F", 4)],
      [n("F", 3), n("E", 3)],
    ].map((notes, vi) => ({
      id: `v${vi}`,
      name: `Voice ${vi + 1}`,
      locked: vi === 1,
      notes: notes.map((note, ni) => ({
        ...note,
        id: `v${vi}n${ni}`,
        time: (ni + 3) * 8,
      })),
    })),
  };
  const findings = check(s).filter((f) => f.rule === "direct-perfect");
  expect(findings.map((f) => findingBars(s, f))).toEqual([
    [4, 5],
    [5, 6],
  ]);
  expect(findings.every((f) => f.severity === "suggestion")).toBe(true);
  expect([...measureFeedback(s, findings)]).toEqual([
    [4, "suggestion"],
    [5, "suggestion"],
    [6, "suggestion"],
  ]);
  s.voices[1].notes[0].pitch = { step: "A", octave: 4, alter: 0 };
  expect(
    check(s)
      .filter((f) => f.rule === "direct-perfect")
      .map((f) => findingBars(s, f)),
  ).toEqual([[5, 6]]);
});
test("strict assessment has a version and cannot pass incomplete or prohibited repetition", async () => {
  const { assess, RULE_VERSION } = await import("../src/rules");
  expect(assess(blank(source())).status).toBe("incomplete");
  const s = source();
  expect(assess(s).status).toBe("pass");
  s.voices[0].notes[2].pitch = clone(s.voices[0].notes[0].pitch);
  expect(assess(s).status).toBe("violations");
  expect(assess(s).ruleVersion).toBe(RULE_VERSION);
});
