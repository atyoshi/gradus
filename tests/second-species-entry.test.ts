import { expect, test } from "vitest";
import fs from "node:fs";
import { assignedSpecies, blank, clone, parseKern, pitch, type Score } from "../src/model";
import { enterPitch, toggleTie } from "../src/entry";
import { resetLinePattern } from "../src/editor";
import { pathStudy } from "../src/path";

const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
const source = (id: string) => parseKern(rows.find((row: any) => row.metadata.id === id));
const historical: Score[] = rows.map(parseKern);
const practice: Score[] = JSON.parse(fs.readFileSync("public/sources/practice.json", "utf8"));
const exercises = [...historical, ...practice].filter((s) =>
  s.voices.some((v) => !v.locked && assignedSpecies(s, v) === 2),
);

test("the second-species catalogue includes all exercises and mixed-species lines", () => {
  expect(exercises.filter((s) => s.species === 2 && s.id.startsWith("gap_"))).toHaveLength(25);
  expect(exercises.filter((s) => s.species === 2 && s.id.startsWith("practice-"))).toHaveLength(9);
  expect(exercises.some((s) => s.id === "gap_122")).toBe(true);
  expect(exercises.some((s) => s.species !== 2)).toBe(true);
});

test.each(exercises.map((s) => [s.id, s] as const))(
  "%s: each second-species slot is independent in new and cleared lines",
  (_id, seed) => {
    const original = clone(seed);
    const fresh = pathStudy(seed, [], null);
    expect(fresh.solution).toEqual(seed.voices);
    expect(seed).toEqual(original);
    for (const voice of fresh.voices.filter((v) => !v.locked && assignedSpecies(fresh, v) === 2)) {
      expect(voice.notes.every((n) => !n.tieStart && !n.tieStop)).toBe(true);
      for (const slot of voice.notes.filter((n) => !n.rest)) {
        const edited = clone(fresh);
        const before = clone(edited);
        enterPitch(edited, slot.id, pitch(35, -1), null);
        const editedVoice = edited.voices.find((v) => v.id === voice.id)!;
        const oldVoice = before.voices.find((v) => v.id === voice.id)!;
        expect(editedVoice.notes.find((n) => n.id === slot.id)?.pitch).toEqual(pitch(35, -1));
        expect(editedVoice.notes.filter((n) => n.id !== slot.id)).toEqual(oldVoice.notes.filter((n) => n.id !== slot.id));
        expect(edited.voices.filter((v) => v.id !== voice.id)).toEqual(before.voices.filter((v) => v.id !== voice.id));
      }
      const edited = clone(fresh);
      const first = voice.notes.find((n) => !n.rest)!;
      enterPitch(edited, first.id, pitch(35), null);
      const reset = resetLinePattern(edited, first.id, [seed])!;
      expect(reset.every((n) => !n.tieStart && !n.tieStop && n.pitch === null)).toBe(true);
    }
  },
);

test("Figure 121 second-species draft does not inherit its source answer's tie", () => {
  const original = source("gap_121");
  const before = clone(original);
  const draft = pathStudy(original, [], null);
  const voice = draft.voices.find((v) => !v.locked && v.species === 2)!;
  expect(original.voices.find((v) => v.id === voice.id)!.notes.some((n) => n.tieStart)).toBe(true);
  expect(voice.notes.every((n) => !n.tieStart && !n.tieStop)).toBe(true);
  expect(draft.solution).toEqual(original.voices);
  expect(original).toEqual(before);
  const preceding = voice.notes.find((n) => n.time === 68)!;
  const following = voice.notes.find((n) => n.time === 72)!;
  const oldFollowing = clone(following);
  enterPitch(draft, preceding.id, pitch(35), null);
  expect(following).toEqual(oldFollowing);
  enterPitch(draft, following.id, pitch(35), null);
  expect(preceding.tieStart).toBeFalsy();
  expect(following.tieStop).toBeFalsy();
  expect(toggleTie(draft, preceding.id)).toBe(true);
  expect(preceding.tieStart).toBe(true);
  expect(following.tieStop).toBe(true);
});

test("clearing Figure 121 does not restore a source-answer tie", () => {
  const original = source("gap_121");
  const draft = blank(original);
  const voice = draft.voices.find((v) => !v.locked && v.species === 2)!;
  voice.notes.find((n) => n.time === 68)!.pitch = pitch(35);
  const reset = resetLinePattern(draft, voice.notes[0].id, [original])!;
  expect(reset.every((n) => !n.tieStart && !n.tieStop)).toBe(true);
});

test("every second-species source slot changes only the entered note", () => {
  const original = source("gap_121");
  const blankDraft = blank(original);
  const voice = blankDraft.voices.find((v) => !v.locked && v.species === 2)!;
  for (const slot of voice.notes.filter((n) => !n.rest)) {
    const draft = clone(blankDraft);
    const before = clone(draft);
    enterPitch(draft, slot.id, pitch(35, -1), null);
    const changed = draft.voices.find((v) => v.id === voice.id)!;
    const old = before.voices.find((v) => v.id === voice.id)!;
    expect(changed.notes.find((n) => n.id === slot.id)?.pitch).toEqual(pitch(35, -1));
    expect(changed.notes.filter((n) => n.id !== slot.id)).toEqual(old.notes.filter((n) => n.id !== slot.id));
    expect(draft.voices.filter((v) => v.id !== voice.id)).toEqual(before.voices.filter((v) => v.id !== voice.id));
  }
});

test("resuming an existing draft preserves even explicitly written ties", () => {
  const original = source("gap_121");
  const draft = blank(original);
  const voice = draft.voices.find((v) => !v.locked && v.species === 2)!;
  enterPitch(draft, voice.notes.find((n) => n.time === 68)!.id, pitch(35), null);
  toggleTie(draft, voice.notes.find((n) => n.time === 68)!.id);
  draft.path = { studyId: original.id, species: 2, voices: 3, mode: original.mode };
  const before = clone(draft);
  expect(pathStudy(original, [draft], null)).toEqual(before);
});
