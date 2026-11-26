import { expect, test } from "vitest";
import fs from "node:fs";
import { assignedSpecies, clone, parseKern, pitch, solutionMatches, upgradeScore, type Score } from "../src/model";
import { enterPitch, toggleTie } from "../src/entry";
import { pathStudy } from "../src/path";

const catalogue: Score[] = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8")).map(parseKern);
const cases = catalogue.flatMap((seed) => seed.voices.flatMap((voice) =>
  !voice.locked && assignedSpecies(seed, voice) === 2
    ? voice.notes.filter((n) => n.tieStart).map((n) => ({ seed, voice, time: n.time })) : [],
));

test("the legacy regression includes all six historical second-species ties", () => {
  expect(cases.map(({ seed, time }) => [seed.id, time])).toEqual([
    ["gap_121", 68], ["gap_122", 68], ["gap_123", 68],
    ["gap_126", 60], ["gap_127", 76], ["gap_128", 76],
  ]);
});

test.each(cases)("$seed.id: saved tie at $time is removed without changing written notes or other voices", ({ seed, voice, time }) => {
  const draft = pathStudy(seed, [], null);
  const line = draft.voices.find((v) => v.id === voice.id)!;
  const first = line.notes.find((n) => n.time === time)!;
  const next = line.notes.find((n) => n.time === time + first.duration)!;
  first.tieStart = next.tieStop = true;
  first.pitch = next.pitch = pitch(24);
  const serialized = JSON.stringify(draft);
  const before = clone(draft);
  for (const restored of [upgradeScore(JSON.parse(serialized), [seed]), pathStudy(seed, [draft], null), pathStudy(seed, [], draft)]) {
    const restoredLine = restored.voices.find((v) => v.id === voice.id)!;
    expect(restoredLine.notes.map(({ tieStart, tieStop, ...note }) => note)).toEqual(line.notes.map(({ tieStart, tieStop, ...note }) => note));
    expect(restoredLine.notes.every((n) => !n.tieStart && !n.tieStop)).toBe(true);
    expect(restored.solution).toEqual(before.solution);
    expect(solutionMatches(restored)).toBe(true);
    const changedRhythm = clone(restored);
    changedRhythm.voices.find((v) => v.id === voice.id)!.notes.find((n) => n.id === first.id)!.duration = 1;
    expect(solutionMatches(changedRhythm)).toBe(false);
    expect(restored.voices.filter((v) => v.id !== voice.id)).toEqual(before.voices.filter((v) => v.id !== voice.id));
    enterPitch(restored, first.id, pitch(25), 8);
    expect(restoredLine.notes.find((n) => n.id === next.id)?.pitch).toEqual(pitch(24));
    expect(toggleTie(restored, first.id)).toBe(false);
  }
  const raw = JSON.parse(serialized) as Score;
  enterPitch(raw, next.id, pitch(26), null);
  expect(raw.voices.find((v) => v.id === voice.id)?.notes.find((n) => n.id === first.id)?.pitch).toEqual(pitch(24));
  expect(draft).toEqual(before);
});

test("loading a saved fourth-species suspension preserves the tie and pitch propagation", () => {
  const seed = catalogue.find((s) => s.species === 4 && s.voices.some((v) => !v.locked && v.notes.some((n) => n.tieStart)))!;
  const draft = pathStudy(seed, [], null);
  const loaded = upgradeScore(JSON.parse(JSON.stringify(draft)), [seed]);
  expect(loaded.voices).toEqual(draft.voices);
  const v = loaded.voices.find((v) => !v.locked && v.species === 4 && v.notes.some((n) => n.tieStart))!;
  const i = v.notes.findIndex((n, i) => n.tieStart && v.notes[i + 1]?.tieStop);
  enterPitch(loaded, v.notes[i].id, pitch(24), null);
  expect(v.notes[i + 1].pitch).toEqual(pitch(24));
});
