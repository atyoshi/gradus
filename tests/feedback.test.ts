import { test, expect } from "vitest";
import fs from "node:fs";
import { parseKern, blank, clone, type Finding } from "../src/model";
import { fromCantus } from "../src/exercises";
import { check, assess } from "../src/rules";
import {
  historicalNotes,
  findingBars,
  barLabel,
  measureFeedback,
  voiceMeasureFeedback,
} from "../src/feedback";
const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
const source = () =>
  parseKern(rows.find((r: any) => r.metadata.id === "gap_005"));
function screenshotExercise() {
  const original = source();
  const s = fromCantus({ ...original, voices: [original.voices[1]] }, 2, 3, 1);
  const cp = s.voices[0],
    bass = s.voices[2];
  cp.notes[0].pitch = { step: "A", alter: 0, octave: 4 };
  cp.notes[1].pitch = { step: "F", alter: 0, octave: 4 };
  cp.notes[2].pitch = { step: "A", alter: 0, octave: 4 };
  bass.notes[0].pitch = { step: "D", alter: 0, octave: 3 };
  cp.notes.find((n) => n.time === 20)!.tieStart = true;
  cp.notes.find((n) => n.time === 24)!.tieStop = true;
  return s;
}
test("screenshot regression: tie flags on two empty future slots are not visible tie violations", () => {
  const s = screenshotExercise();
  expect(check(s).filter((f) => f.severity === "error")).toEqual([]);
});
test("the same unsupported tie is reported once both endpoints are actually written", () => {
  const s = screenshotExercise();
  s.voices[0].notes.find((n) => n.time === 20)!.pitch = {
    step: "D",
    alter: 0,
    octave: 5,
  };
  s.voices[0].notes.find((n) => n.time === 24)!.pitch = {
    step: "D",
    alter: 0,
    octave: 5,
  };
  expect(
    check(s).some((f) => f.rule === "species-tie" && f.severity === "error"),
  ).toBe(true);
});
test("measure attribution includes both sides of a parallel and a note held across the barline", () => {
  const s = source();
  const f: Finding = {
    rule: "parallels",
    severity: "error",
    message: "test",
    source: "Fux",
    notes: ["v1n0", "v1n8"],
  };
  expect(findingBars(s, f)).toEqual([1, 2]);
  s.voices[0].notes[0].time = 4;
  s.voices[0].notes[0].duration = 8;
  expect(findingBars(s, { ...f, notes: ["v1n0"] })).toEqual([1, 2]);
});
test("errors override suggestion shading, checking placeholders create no highlights", () => {
  const s = source();
  const suggestion: Finding = {
    rule: "range",
    severity: "suggestion",
    message: "test",
    source: "Fux",
    notes: ["v1n0"],
  };
  const error = {
    ...suggestion,
    rule: "dissonance",
    severity: "error" as const,
  };
  expect(measureFeedback(s, [suggestion, error]).get(1)).toBe("error");
  expect(measureFeedback(s, [error, suggestion]).get(1)).toBe("error");
  expect(measureFeedback(s, [{ ...error, rule: "checking" }]).size).toBe(0);
});
test("feedback shades only the individual voice and bars named by a finding", () => {
  const s = source();
  const [top, bass] = s.voices;
  top.notes[0].time = 4;
  top.notes[0].duration = 8;
  const f: Finding = {
    rule: "parallels",
    severity: "error",
    message: "test",
    source: "Fux",
    notes: [top.notes[0].id, bass.notes[2].id],
  };
  const states = voiceMeasureFeedback(s, [f]);
  expect([...states.get(top.id)!.entries()]).toEqual([
    [1, "error"],
    [2, "error"],
  ]);
  expect([...states.get(bass.id)!.entries()]).toEqual([[3, "error"]]);
  expect(
    voiceMeasureFeedback(s, [{ ...f, notes: [top.notes[0].id] }]).has(bass.id),
  ).toBe(false);
});
test("an error in one voice does not replace another voice's suggestion", () => {
  const s = source();
  const [top, bass] = s.voices;
  const suggestion: Finding = {
    rule: "range",
    severity: "suggestion",
    message: "test",
    source: "Fux",
    notes: [top.notes[0].id, bass.notes[0].id],
  };
  const error: Finding = {
    ...suggestion,
    rule: "mode",
    severity: "error",
    notes: [top.notes[0].id],
  };
  for (const findings of [
    [suggestion, error],
    [error, suggestion],
  ]) {
    const states = voiceMeasureFeedback(s, findings);
    expect(states.get(top.id)?.get(1)).toBe("error");
    expect(states.get(bass.id)?.get(1)).toBe("suggestion");
  }
  expect(voiceMeasureFeedback(s, [{ ...error, rule: "checking" }]).size).toBe(
    0,
  );
});
test("bar labels do not imply that unrelated intervening measures are wrong", () => {
  expect(barLabel([1])).toBe("Bar 1");
  expect(barLabel([1, 2])).toBe("Bars 1–2");
  expect(barLabel([1, 3])).toBe("Bars 1, 3");
  expect(barLabel([])).toBe("");
});
test("a single written note from a checked solution is not falsely rejected because its neighbors are still blank", () => {
  const templates = JSON.parse(
    fs.readFileSync("public/sources/practice.json", "utf8"),
  );
  const failures: string[] = [];
  for (const full of templates) {
    for (let vi = 0; vi < full.voices.length; vi++) {
      if (full.voices[vi].locked) continue;
      for (let ni = 0; ni < full.voices[vi].notes.length; ni++) {
        const original = full.voices[vi].notes[ni];
        if (!original.pitch || original.rest) continue;
        const draft = blank(full);
        draft.voices[vi].notes[ni].pitch = clone(original.pitch);
        const errors = check(draft).filter((f) => f.severity === "error");
        if (errors.length)
          failures.push(
            `${full.id} ${original.id}: ${errors.map((f) => f.rule).join(", ")}`,
          );
      }
    }
  }
  expect(failures.slice(0, 20)).toEqual([]);
}, 30000);
test("entering checked solutions in score order does not produce false violations while other voices remain unwritten", () => {
  const templates = JSON.parse(
    fs.readFileSync("public/sources/practice.json", "utf8"),
  );
  const failures: string[] = [];
  for (const full of templates) {
    const draft = blank(full);
    const entries = full.voices
      .flatMap((v: any, vi: number) =>
        v.locked ? [] : v.notes.map((n: any, ni: number) => ({ n, vi, ni })),
      )
      .filter((x: any) => x.n.pitch && !x.n.rest)
      .sort((a: any, b: any) => a.n.time - b.n.time || a.vi - b.vi);
    for (const { n, vi, ni } of entries) {
      draft.voices[vi].notes[ni].pitch = clone(n.pitch);
      const errors = check(draft).filter((f) => f.severity === "error");
      if (errors.length) {
        failures.push(
          `${full.id} after ${n.id}: ${errors.map((f) => f.rule).join(", ")}`,
        );
        break;
      }
    }
  }
  expect(failures).toEqual([]);
}, 30000);
test("first-species dissonances do not wait for an unrelated future melody note", () => {
  const s = blank(source());
  s.voices[0].notes.find((n) => n.time === 16)!.pitch = {
    step: "F",
    alter: 0,
    octave: 4,
  };
  expect(
    check(s).some((f) => f.rule === "dissonance" && f.notes.includes("v1n16")),
  ).toBe(true);
});
test("second-species downbeat bass fourth is marked before the following half note is written", () => {
  const original = source();
  const s = fromCantus({ ...original, voices: [original.voices[1]] }, 2, 3, 1);
  const top = s.voices[0],
    bass = s.voices[2];
  for (const [time, step] of [
    [0, "F"],
    [4, "E"],
    [8, "D"],
  ] as const)
    top.notes.find((n) => n.time === time)!.pitch = {
      step,
      alter: 0,
      octave: 5,
    };
  bass.notes.find((n) => n.time === 0)!.pitch = {
    step: "D",
    alter: 0,
    octave: 3,
  };
  bass.notes.find((n) => n.time === 8)!.pitch = {
    step: "A",
    alter: 0,
    octave: 2,
  };
  const arrival = top.notes.find((n) => n.time === 8)!;
  const bassA = bass.notes.find((n) => n.time === 8)!;
  expect(top.notes.find((n) => n.time === 12)!.pitch).toBeFalsy();
  const findings = check(s);
  expect(
    findings.some(
      (f) =>
        f.rule === "dissonance" &&
        f.notes.includes(arrival.id) &&
        f.notes.includes(bassA.id),
    ),
  ).toBe(true);
  expect(voiceMeasureFeedback(s, findings).get(top.id)?.get(2)).toBe("error");
  expect(voiceMeasureFeedback(s, findings).get(bass.id)?.get(2)).toBe("error");
});
test("an ambiguous upper fourth waits for the bass, then a proven bass fourth is marked", () => {
  const original = source();
  const s = fromCantus({ ...original, voices: [original.voices[1]] }, 1, 3, 1);
  s.voices[1].notes[0].pitch = { step: "C", alter: 0, octave: 4 };
  s.voices[0].notes[0].pitch = { step: "F", alter: 0, octave: 4 };
  expect(check(s).filter((f) => f.rule === "dissonance")).toEqual([]);
  s.voices[2].notes[0].pitch = { step: "C", alter: 0, octave: 3 };
  expect(check(s).some((f) => f.rule === "dissonance")).toBe(true);
});
test("a bass fourth is marked while the middle voice is still blank", () => {
  const original = source();
  const s = fromCantus({ ...original, voices: [original.voices[1]] }, 1, 3, 2);
  const top = s.voices[0].notes[0];
  const bass = s.voices[2].notes[0];
  top.pitch = { step: "F", alter: 0, octave: 4 };
  bass.pitch = { step: "C", alter: 0, octave: 4 };
  s.voices[1].notes[0].pitch = null;
  const hasFourth = () =>
    check(s).some(
      (f) =>
        f.rule === "dissonance" &&
        f.notes.includes(top.id) &&
        f.notes.includes(bass.id),
    );
  expect(hasFourth()).toBe(true);
  s.voices[1].notes[0].pitch = { step: "B", alter: 0, octave: 4 };
  expect(hasFourth()).toBe(true);
});
test("a written crossing uses the sounding bass for upper fourths", () => {
  const original = source();
  const s = fromCantus({ ...original, voices: [original.voices[1]] }, 1, 3, 1);
  s.voices[0].notes[0].pitch = { step: "A", alter: 0, octave: 3 };
  s.voices[1].notes[0].pitch = { step: "C", alter: 0, octave: 4 };
  s.voices[2].notes[0].pitch = { step: "F", alter: 0, octave: 4 };
  expect(check(s).filter((f) => f.rule === "dissonance")).toEqual([]);
});

test("historical editorial context is readable information and does not grade a student's notes", () => {
  const score = parseKern(rows.find((r: any) => r.metadata.id === "gap_055"));
  expect(score.source?.editorialNotes?.[0]).toContain("source.systems");
  expect(historicalNotes(score)[0]).toContain("soprano clef");
  expect(historicalNotes(score)[0]).toContain("not a mistake in your notes");
  expect(historicalNotes(score).join(" ")).not.toContain("source.systems");
  const before = assess(score);
  const without = clone(score);
  without.source!.editorialNotes = [];
  expect(before).toEqual(assess(without));
  expect(before.status).toBe("pass");
  score.voices
    .find((v) => !v.locked)!
    .notes.find((n) => !!n.pitch)!.pitch!.alter = 1;
  expect(assess(score).status).not.toBe("pass");
});
