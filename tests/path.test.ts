import { test, expect } from "vitest";
import fs from "node:fs";
import { orderedPath, pathStudy } from "../src/path";
import { clone, modes, parseKern, solutionMatches, type Score } from "../src/model";
const templates: Score[] = JSON.parse(
  fs.readFileSync("public/sources/practice.json", "utf8"),
);
test("choosing a path study loads that exact species, voices, mode, cantus and assigned rhythm", () => {
  for (const seed of templates) {
    const next = pathStudy(seed, [], null);
    expect(next.path?.studyId).toBe(seed.id);
    expect(next.species).toBe(seed.species);
    expect(next.voices.length).toBe(seed.voices.length);
    expect(next.mode).toBe(seed.mode);
    for (let i = 0; i < seed.voices.length; i++) {
      const omitSourceTies = !seed.voices[i].locked && [2, 5].includes(next.voices[i].species ?? 0);
      expect(
        next.voices[i].notes.map((n) => [
          n.time,
          n.duration,
          !!n.rest,
          !!n.tieStart,
          !!n.tieStop,
        ]),
      ).toEqual(
        seed.voices[i].notes.map((n) => [
          n.time,
          n.duration,
          !!n.rest,
          !omitSourceTies && !!n.tieStart,
          !omitSourceTies && !!n.tieStop,
        ]),
      );
      if (seed.voices[i].locked)
        expect(next.voices[i]).toMatchObject(seed.voices[i]);
    }
    expect(next.id).toBe("path-" + seed.id);
  }
});
test("revisiting a path study resumes its notes instead of generating or substituting another exercise", () => {
  const seed = templates[0],
    draft = pathStudy(seed, [], null);
  draft.voices.find((v) => !v.locked)!.notes[0].pitch = {
    step: "A",
    alter: 0,
    octave: 4,
  };
  expect(pathStudy(seed, [draft], null)).toEqual(draft);
  expect(pathStudy(seed, [], draft)).toEqual(draft);
  expect(pathStudy(templates[1], [draft], draft).path?.studyId).toBe(
    templates[1].id,
  );
  expect(seed.voices[0].notes).not.toEqual(draft.voices[0].notes);
});

test("the guided path includes every historical study across all six modes", () => {
  const historical = JSON.parse(
    fs.readFileSync("public/sources/fux.json", "utf8"),
  ).map(parseKern) as Score[];
  const path = orderedPath([...historical, ...templates]);
  expect(path).toHaveLength(historical.length + templates.length);
  expect(
    new Set(path.filter((s) => s.source?.exerciseId).map((s) => s.mode)),
  ).toEqual(new Set(modes));
  for (const seed of historical) {
    expect(path).toContain(seed);
    const draft = pathStudy(seed, [], null);
    expect(draft.path?.studyId).toBe(seed.id);
    expect(draft.mode).toBe(seed.mode);
    expect(draft.solution).toEqual(seed.voices);
    expect(draft.voices.find((v) => v.locked)).toEqual(
      seed.voices.find((v) => v.locked),
    );
  }
  expect(path.slice(0, 3).every((s) => s.cantusOnly)).toBe(true);
  const species = path.filter((s) => !s.cantusOnly).map((s) => s.species);
  expect(species).toEqual([...species].sort((a, b) => a - b));
});

test("a new florid draft omits model ties while resuming preserves a student's written tie", () => {
  const row = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"))
    .find((r: { metadata: { id: string } }) => r.metadata.id === "gap_082");
  const seed = parseKern(row);
  const draft = pathStudy(seed, [], null);
  const voice = draft.voices.find(v => !v.locked)!;
  const model = seed.voices.find(v => v.id === voice.id)!;
  expect(voice.notes.some(n => n.tieStart || n.tieStop)).toBe(false);
  expect(model.notes.some(n => n.tieStart)).toBe(true);
  expect(draft.solution).toEqual(seed.voices);
  expect(solutionMatches(draft)).toBe(true);
  const [first, second] = voice.notes.slice(1, 3);
  first.pitch = second.pitch = { step: "A", octave: 4, alter: 0 };
  first.tieStart = second.tieStop = true;
  expect(pathStudy(seed, [draft], null)).toEqual(draft);
});
