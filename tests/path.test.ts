import { test, expect } from "vitest";
import fs from "node:fs";
import { orderedPath, pathStudy } from "../src/path";
import { clone, modes, parseKern, type Score } from "../src/model";
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
          !!n.tieStart,
          !!n.tieStop,
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
  expect(pathStudy(seed, [draft], null)).toBe(draft);
  expect(pathStudy(seed, [], draft)).toBe(draft);
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
