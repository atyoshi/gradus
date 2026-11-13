import fs from "node:fs";
import { catalogue, solve } from "../src/exercises.ts";
import { clone, blank, complete } from "../src/model.ts";
import { check } from "../src/rules.ts";
const all = catalogue(
  JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8")),
);
const practice = [];
for (const voices of [2, 3, 4])
  for (const species of [1, 2, 3, 4, 5]) {
    let pool = all.filter(
      (s) => s.voices.length === voices && s.species === species && s.verified,
    );
    if (!pool.length) {
      for (const source of all.filter(
        (s) => s.voices.length === voices && s.species === species,
      )) {
        const s = clone(source);
        const ids = new Set(
          check(s)
            .filter((f) => f.severity === "error")
            .flatMap((f) => f.notes),
        );
        // Keep most of the source intact; repair the later editable note in each failed relation.
        const errors = check(s).filter((f) => f.severity === "error");
        for (const f of errors) {
          const ns = s.voices
            .filter((v) => !v.locked)
            .flatMap((v) => v.notes)
            .filter((n) => f.notes.includes(n.id));
          const n = ns.at(-1);
          if (n) n.pitch = null;
        }
        const answer = solve(s, source.voices, 15000);
        if (answer) {
          s.voices = answer;
          s.title = "Practice adaptation · " + source.title;
          s.verified = true;
          pool.push(s);
          break;
        }
      }
    }
    if (!pool.length)
      throw Error(`No verified seed for ${voices}v species ${species}`);
    for (let i = 0; i < 3; i++) {
      const s = clone(pool[i % pool.length]);
      const shift = i < pool.length ? 0 : i % 2 === 0 ? -1 : 1;
      s.voices.forEach((v) =>
        v.notes.forEach((n) => {
          if (n.pitch) n.pitch.octave += shift;
        }),
      );
      s.id = `practice-${voices}-${species}-${i}`;
      s.title = `Study ${i + 1} · ${voices} voices · species ${species}`;
      s.source = {
        ...s.source!,
        title: `Practice adaptation of ${pool[i % pool.length].title}; Fux p. ${s.source?.page}. Wilson / Gotham transcription (CC0).`,
      };
      if (!complete(s) || check(s).some((f) => f.severity === "error"))
        throw Error(s.title + " failed");
      practice.push(s);
    }
  }
for (const mode of ["Dorian", "Phrygian", "Ionian"]) {
  const tonic = {
    Dorian: { step: "D", alter: 0, octave: 4 },
    Phrygian: { step: "E", alter: 0, octave: 4 },
    Ionian: { step: "C", alter: 0, octave: 4 },
  }[mode]!;
  const degrees =
    mode === "Phrygian"
      ? ["E", "G", "F", "E", "C", "D", "F", "E"]
      : mode === "Dorian"
        ? ["D", "F", "E", "G", "F", "E", "C", "D"]
        : ["C", "E", "D", "F", "E", "D", "B", "C"];
  const notes = degrees.map((step, i) => ({
    id: `v1n${i * 8}`,
    time: i * 8,
    duration: 8,
    pitch: { ...tonic, step, octave: mode === "Ionian" && i === 6 ? 3 : 4 },
  }));
  const s: any = {
    version: 1,
    id: `cantus-${mode}`,
    title: `Cantus study · ${mode}`,
    mode,
    species: 1,
    bars: 8,
    cantusOnly: true,
    requirements: { stepwiseCantusEnding: true },
    verified: true,
    voices: [{ id: "v1", name: "Your cantus", locked: false, notes }],
  };
  if (check(s).some((f) => f.severity === "error"))
    throw Error("Cantus failed");
  practice.push(s);
}
fs.writeFileSync("public/sources/practice.json", JSON.stringify(practice));
console.log(`Created ${practice.length} practice templates, all checked.`);
