import { emptyPattern } from "./editor";
import {
  type Score,
  type Voice,
  clone,
  blank,
  parseKern,
  degree,
  pitch,
  complete,
  midi,
  at,
  assignSpecies,
} from "./model.ts";
import { check, assess, fitsAeolianCadentialSixth, RULE_VERSION } from "./rules.ts";
export function catalogue(rows: any[]): Score[] {
  return rows
    .map(parseKern)
    .filter(
      (s) =>
        s.voices.length >= 2 &&
        s.voices.length <= 4 &&
        s.species >= 1 &&
        s.species <= 5,
    )
    .map((s) => ({
      ...s,
      validationVersion: RULE_VERSION,
      verified: assess(s).status === "pass",
    }));
}
export function solve(
  s: Score,
  reference?: Voice[],
  limit = 1200,
): Voice[] | null {
  const work = clone(s);
  const slots = work.voices
    .flatMap((v, vi) =>
      v.locked ? [] : v.notes.map((n, ni) => ({ n, vi, ni })),
    )
    .filter((z) => !z.n.pitch && !z.n.rest)
    .sort((a, b) => a.n.time - b.n.time || a.vi - b.vi);
  let nodes = 0;
  const start = Date.now();
  function visit(k: number): boolean {
    if (++nodes > limit || Date.now() - start > 700) return false;
    if (k === slots.length) return assess(work).status === "pass";
    const { n, vi, ni } = slots[k];
    const ref = reference?.[vi]?.notes[ni]?.pitch;
    const prev = work.voices[vi].notes[ni - 1];
    let candidates = Array.from({ length: 22 }, (_, i) => pitch(21 + i));
    if (n.tieStop && prev?.pitch) candidates = [prev.pitch];
    else if (ref)
      candidates.sort(
        (a, b) =>
          Math.abs(degree(a) - degree(ref)) - Math.abs(degree(b) - degree(ref)),
      );
    if (n.time >= work.bars * 8 - 16 && work.mode !== "Phrygian") {
      const cf = work.voices.find((v) => v.locked);
      const final = cf?.notes.at(-1)?.pitch;
      if (final)
        candidates = candidates.flatMap((p) =>
          degree(p) % 7 === (degree(final) + 6) % 7
            ? [
                {
                  ...p,
                  alter: Math.max(
                    -1,
                    Math.min(1, ((midi(final) - 1 - midi(p) + 126) % 12) - 6),
                  ),
                },
                p,
              ]
            : [p],
        );
    }
    if (work.mode === "Aeolian" && n.time === (work.bars - 2) * 8 && !n.tieStop) {
      const voice = work.voices[vi];
      const inflections = candidates.flatMap((p) => [-1, 1].flatMap((alter) => {
        const inflected = { ...p, alter };
        return fitsAeolianCadentialSixth(work, voice, n, inflected) ? [inflected] : [];
      }));
      candidates.unshift(...inflections);
    }
    if (ref) candidates.unshift(ref);
    for (const p of candidates) {
      n.pitch = p;
      if (!check(work).some((f) => f.severity === "error") && visit(k + 1))
        return true;
    }
    n.pitch = null;
    return false;
  }
  return visit(0) ? work.voices : null;
}
/** Compare melodies independently of voice position and catalog identity. */
export function cantusKey(s: Score): string {
  return JSON.stringify(
    s.voices
      .find((v) => v.locked)
      ?.notes.map((n) => [
        n.time,
        n.duration,
        n.pitch ? [n.pitch.step, n.pitch.alter, n.pitch.octave] : null,
        !!n.rest,
      ]),
  );
}
export function fresh(seed: Score, excluded: string[] = []): Score {
  const started = Date.now();
  for (
    let attempt = 0;
    attempt < 60 && Date.now() - started < 6000;
    attempt++
  ) {
    const s = clone(seed);
    const cf = s.voices.find((v) => v.locked)!;
    const positions = Array.from(
      { length: Math.max(0, cf.notes.length - 3) },
      (_, i) => i + 1,
    );
    const count = Math.min(
      positions.length,
      attempt < 40 ? 2 + (attempt % 3) : 1,
    );
    for (let k = 0; k < count; k++) {
      const [i] = positions.splice(
        Math.floor(Math.random() * positions.length),
        1,
      );
      const n = cf.notes[i];
      if (n?.pitch) {
        const delta = [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
        n.pitch = pitch(degree(n.pitch) + delta);
      }
    }
    if (cantusKey(s) === cantusKey(seed) || excluded.includes(cantusKey(s)))
      continue;
    const cantusStudy: Score = {
      ...s,
      species: 1,
      cantusOnly: true,
      voices: [{ ...cf, locked: false }],
    };
    if (check(cantusStudy).some((finding) => finding.severity === "error"))
      continue;
    const draft = blank(s);
    const answer = solve(draft, seed.voices, 900);
    if (answer) {
      draft.title = "New cantus · " + seed.mode;
      draft.solution = answer;
      draft.verified = true;
      draft.validationVersion = RULE_VERSION;
      draft.generated = true;
      draft.source = {
        title:
          "Original variation generated locally; checked against the Fux practice rules.",
        url: "https://www.digital.wienbibliothek.at/wbrobv/content/titleinfo/4118035",
      };
      return draft;
    }
  }
  throw Error(
    "No different, solvable cantus was found. Your current exercise is still open. Try again or choose another mode or voice count.",
  );
}
export function cantus(mode: string): Score {
  return {
    version: 1,
    id: crypto.randomUUID(),
    title: "Write a cantus firmus",
    species: 1,
    mode,
    bars: 8,
    cantusOnly: true,
    requirements: { stepwiseCantusEnding: true },
    voices: [
      {
        id: "v1",
        name: "Your cantus",
        locked: false,
        notes: Array.from({ length: 8 }, (_, i) => ({
          id: `v1n${i * 8}`,
          time: i * 8,
          duration: 8,
          pitch: null,
        })),
      },
    ],
  };
}
export function summary(s: Score) {
  const fs = check(s);
  return {
    errors: fs.filter((f) => f.severity === "error").length,
    suggestions: fs.filter((f) => f.severity === "suggestion").length,
    complete: complete(s),
  };
}
export function fromCantus(
  input: Score,
  species: number,
  count: number,
  position = count - 1,
): Score {
  if (input.voices[0].notes.length !== input.bars || input.voices[0].notes.some((n, i) => n.time !== i * 8 || n.duration !== 8 || n.rest || !n.pitch))
    throw Error(
      "A cantus import needs one pitched whole note in each measure.",
    );
  const s = clone(input);
  const cf = clone(s.voices[0]);
  const moving = position === 0 ? 1 : 0;
  s.cantusOnly = false;
  s.species = species;
  s.id = crypto.randomUUID();
  s.title = input.cantusOnly ? "Counterpoint on your cantus" : "Counterpoint on an imported cantus";
  s.clefs = input.clefs?.[0] ? Array.from({ length: count }, (_, i) => i === position ? input.clefs![0] : "") : undefined;
  s.path = undefined;
  s.source = undefined;
  s.generated = false;
  s.verified = false;
  s.solution = undefined;
  s.voices = Array.from({ length: count }, (_, vi) => {
    if (vi === position)
      return {
        ...cf,
        id: `v${vi}`,
        name: "Cantus firmus",
        locked: true,
        notes: cf.notes.map((n, i) => ({ ...n, id: `v${vi}n${i}` })),
      };
    const notes = emptyPattern(`v${vi}`, s.bars, vi === moving ? species : 1);
    return { id: `v${vi}`, name: `Voice ${vi + 1}`, locked: false, notes };
  });
  s.voices.forEach((v, vi) => {
    v.species = v.locked || vi !== moving ? 1 : species;
  });
  return assignSpecies(s);
}
