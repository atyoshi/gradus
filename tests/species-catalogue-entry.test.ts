import { expect, test } from "vitest";
import fs from "node:fs";
import { assignedSpecies, clone, parseKern, pitch, type Score } from "../src/model";
import { enterPitch } from "../src/entry";
import { pathStudy } from "../src/path";

const historical: Score[] = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8")).map(parseKern);
const practice: Score[] = JSON.parse(fs.readFileSync("public/sources/practice.json", "utf8"));
const catalog = [...historical, ...practice].filter((s) => !s.cantusOnly && s.species >= 1 && s.species <= 4);

test("catalogue coverage includes every first through fourth species study", () => {
  expect([1, 2, 3, 4].map((n) => historical.filter((s) => s.species === n).length)).toEqual([37, 25, 19, 20]);
  expect([1, 2, 3, 4].map((n) => practice.filter((s) => !s.cantusOnly && s.species === n).length)).toEqual([9, 9, 9, 9]);
});

test.each(catalog.map((s) => [s.id, s] as const))(
  "%s preserves assigned rhythms, other voices and rests for every note entry",
  (_id, seed) => {
    const draft = pathStudy(seed, [], null);
    const shape = (s: Score) => s.voices.map((v) => v.notes.map((n) => [n.id, n.time, n.duration, !!n.rest]));
    for (const voice of draft.voices.filter((v) => !v.locked && assignedSpecies(draft, v) <= 4)) {
      for (const slot of voice.notes.filter((n) => !n.rest)) {
        const edited = clone(draft);
        const before = clone(edited);
        const result = enterPitch(edited, slot.id, pitch(35), 1)!;
        expect(result.pitch).toEqual(pitch(35));
        expect(shape(edited)).toEqual(shape(before));
        expect(edited.voices.filter((v) => v.id !== voice.id)).toEqual(before.voices.filter((v) => v.id !== voice.id));
        const current = edited.voices.find((v) => v.id === voice.id)!;
        const index = current.notes.findIndex((n) => n.id === slot.id);
        for (let i = 0; i < current.notes.length; i++) {
          const n = current.notes[i];
          if (i !== index && n.pitch) {
            expect(Math.abs(i - index)).toBe(1);
            const left = current.notes[Math.min(i, index)];
            const right = current.notes[Math.max(i, index)];
            expect(left.tieStart && right.tieStop).toBe(true);
            expect(n.pitch).toEqual(result.pitch);
          }
        }
      }
    }
  },
);
