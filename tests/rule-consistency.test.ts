import fs from "node:fs";
import { expect, test } from "vitest";
import { compatiblePitches } from "../src/candidates";
import { solve } from "../src/exercises";
import { clone, degree, midi, parseKern, pitch, type Score } from "../src/model";
import { assess, check } from "../src/rules";

const historical = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8")).map(parseKern) as Score[];
const practice = JSON.parse(fs.readFileSync("public/sources/practice.json", "utf8")) as Score[];
const figure = (id: string) => clone(historical.find((s) => s.id === `gap_${id}`)!);
const hardErrors = (s: Score) => check(s).filter((f) => f.severity === "error");

// Frozen exceptions, independent of both the live checker and regenerable audit.
// Unresolved source readings are not claimed to be known-good examples.
const review = "041 056 110 130 133 158 169 170 177 184 185".split(" ");
const unresolved = "134 183 186 203 204".split(" ");
const accepted = historical.filter((s) => ![...review, ...unresolved].includes(s.id.slice(4)));
const models = [...accepted, ...practice];

for (const voices of [1, 2, 3, 4]) {
  for (const species of voices === 1 ? [1] : [1, 2, 3, 4, 5]) {
    test(`${voices} voice(s), species ${species}: valid models stay viable in either entry order`, () => {
      const cases = models.filter((s) => s.voices.length === voices && s.species === species);
      expect(cases.length).toBeGreaterThan(0);
      for (const s of cases) {
        expect(assess(s).status, s.id).toBe("pass");
        const attacks = s.voices.flatMap((v, vi) => v.locked ? [] : v.notes.flatMap((n, ni) =>
          n.pitch && !n.rest ? [{ vi, ni, n }] : [],
        ));
        for (const direction of [1, -1]) {
          const draft = clone(s);
          for (const { vi, ni } of attacks) draft.voices[vi].notes[ni].pitch = null;
          expect(assess(draft).status, s.id).toBe("incomplete");
          attacks.sort((a, b) => direction * (a.n.time - b.n.time) || a.vi - b.vi);
          for (const { vi, ni, n } of attacks) {
            draft.voices[vi].notes[ni].pitch = n.pitch;
            const errors = hardErrors(draft);
            if (errors.length) {
              expect(errors.map((f) => [f.rule, f.notes]), `${s.id}, ${direction === 1 ? "forward" : "backward"}, ${n.id}`).toEqual([]);
            }
          }
          expect(draft.voices).toEqual(s.voices);
        }
        const gap = clone(s);
        for (const { vi, ni, n } of attacks) {
          const note = gap.voices[vi].notes[ni];
          note.pitch = null;
          const errors = hardErrors(gap);
          if (errors.length)
            expect(errors.map((f) => [f.rule, f.notes]), `${s.id}, blank ${n.id}`).toEqual([]);
          note.pitch = n.pitch;
        }
      }
    });
  }
}

test("the fixed historical witness set is complete and covers all six modes", () => {
  expect(historical).toHaveLength(123);
  expect(accepted).toHaveLength(107);
  expect(practice).toHaveLength(48);
  expect(new Set(accepted.map((s) => s.mode))).toHaveLength(6);
});

test("octave transposition preserves rule findings", () => {
  for (const s of [...historical, ...practice]) {
    const shifted = clone(s);
    shifted.voices.forEach((v) => v.notes.forEach((n) => { if (n.pitch) n.pitch.octave++; }));
    const signature = (x: Score) => check(x).map((f) => [f.rule, f.severity, f.basis, f.notes]);
    expect(signature(shifted), s.id).toEqual(signature(s));
  }
});

test("a written small bridge still leaves the second-species structural octaves exposed", () => {
  const s = figure("036");
  const bridge = s.voices[0].notes.find((n) => n.time === 28)!;
  const findings = () => hardErrors(s).filter((f) => f.rule === "downbeat-parallels");
  expect(findings()).toEqual([]);
  bridge.pitch = null;
  expect(findings()).toEqual([]);
  const candidates = compatiblePitches(s, bridge.id, null);
  expect(candidates).toContainEqual({ step: "G", octave: 4, alter: 0 });
  expect(candidates).not.toContainEqual({ step: "B", octave: 4, alter: 0 });
  bridge.pitch = { step: "B", octave: 4, alter: 0 };
  expect(findings()).toContainEqual(expect.objectContaining({
    notes: expect.arrayContaining(["v1n24", "v2n24", "v1n28", "v1n32", "v2n32"]),
  }));
});

function transpose(s: Score, steps: number, semitones: number) {
  for (const v of s.voices) {
    for (const n of v.notes) {
      if (!n.pitch) continue;
      const natural = pitch(degree(n.pitch) + steps);
      n.pitch = { ...natural, alter: midi(n.pitch) + semitones - midi(natural) };
    }
  }
  return s;
}

test.each([0, 1])("Aeolian cadence in register %i: hints, solver and checker agree without a reference answer", (octaves) => {
  const s = transpose(figure("042"), octaves * 7, octaves * 12);
  delete s.solution;
  const [upper] = s.voices;
  const [sixth, leading, final] = upper.notes.slice(-3);
  const expected = sixth.pitch!;
  sixth.pitch = null;
  const partial = clone(s);
  partial.voices[0].notes.at(-2)!.pitch = null;
  partial.voices[0].notes.at(-1)!.pitch = null;
  expect(compatiblePitches(partial, sixth.id, null)).toContainEqual(expected);
  const answer = solve(s, undefined, 1200);
  expect(answer?.[0].notes.at(-3)?.pitch).toEqual(expected);
  expect(assess({ ...s, voices: answer! }).status).toBe("pass");
  expect([sixth.pitch, leading.pitch?.step, final.pitch?.step]).toEqual([null, "G", "A"]);
});

test("hinting the next note respects the raised Aeolian sixth already written", () => {
  const s = figure("042");
  const [sixth, leading, final] = s.voices[0].notes.slice(-3);
  const expected = leading.pitch!;
  const natural = { ...expected, alter: 0 };
  leading.pitch = final.pitch = null;
  const hints = compatiblePitches(s, leading.id, null);
  expect(hints).toContainEqual(expected);
  expect(hints).not.toContainEqual(natural);
  leading.pitch = natural;
  expect(check(s)).toContainEqual(expect.objectContaining({
    rule: "mode", basis: "review", notes: [sixth.id, leading.id],
  }));
});
