export type Pitch = { step: string; alter: number; octave: number };
export type Note = {
  id: string;
  time: number;
  duration: number;
  pitch: Pitch | null;
  rest?: boolean;
  tieStart?: boolean;
  tieStop?: boolean;
};
export type Voice = {
  id: string;
  name: string;
  locked: boolean;
  notes: Note[];
  species?: number;
};
export type Score = {
  version: 1;
  id: string;
  title: string;
  libraryUpdatedAt?: string;
  species: number;
  mode: string;
  bars: number;
  voices: Voice[];
  source?: {
    title: string;
    url: string;
    page?: number;
    exerciseId?: string;
    declaredSpecies?: number[];
    editorialNotes?: string[];
    corrected?: boolean;
  };
  solution?: Voice[];
  verified?: boolean;
  validationVersion?: string;
  generated?: boolean;
  cantusOnly?: boolean;
  clefs?: string[];
  path?: { studyId: string; species: number; voices: number; mode: string };
  requirements?: { stepwiseCantusEnding?: boolean };
};
export type Finding = {
  rule: string;
  severity: "error" | "suggestion";
  message: string;
  notes: string[];
  source: string;
  lessonId?: string;
  basis?: "rule" | "craft" | "exercise" | "review";
  details?: string;
  action?: string;
  reference?: { title: string; url: string; pages: string };
};
export const modes = [
  "Dorian",
  "Phrygian",
  "Lydian",
  "Mixolydian",
  "Aeolian",
  "Ionian",
];
export const steps = ["C", "D", "E", "F", "G", "A", "B"];
export const pc = [0, 2, 4, 5, 7, 9, 11];
export function midi(p: Pitch) {
  return (p.octave + 1) * 12 + pc[steps.indexOf(p.step)] + p.alter;
}
export function degree(p: Pitch) {
  return p.octave * 7 + steps.indexOf(p.step);
}
export function pitch(d: number, alter = 0): Pitch {
  return { step: steps[((d % 7) + 7) % 7], octave: Math.floor(d / 7), alter };
}
export function label(p: Pitch | null) {
  return p
    ? `${p.step}${p.alter === 1 ? "♯" : p.alter === -1 ? "♭" : ""}${p.octave}`
    : "—";
}
export function at(v: Voice, t: number) {
  return v.notes.find((n) => n.time <= t && n.time + n.duration > t);
}
export function clone<T>(v: T): T {
  return structuredClone(v);
}
/** Infer assignments from the retained rhythm, never from a student's pitches. */
export function assignedSpecies(s: Score, v: Voice): number {
  if (v.locked) return 1;
  if (v.species !== undefined) return v.species;
  if (s.voices.length <= 2) return s.species;
  const reference = s.solution?.find((r) => r.id === v.id) || v;
  const interior = reference.notes.filter((n) => n.time < (s.bars - 1) * 8);
  if (interior.every((n) => n.duration === 8)) return 1;
  const declared = s.source?.declaredSpecies || [s.species];
  if (
    declared.length === 1 &&
    declared[0] === 4 &&
    interior.filter((n) => n.duration === 8).length > interior.length / 2 &&
    !interior.some((n) => n.tieStart || n.tieStop)
  )
    return 1;
  if (declared.length === 1) return s.species;
  if (declared.includes(4) && interior.some((n) => n.tieStart || n.tieStop))
    return 4;
  if (interior.some((n) => n.duration < 2)) return 5;
  if (interior.some((n) => n.duration === 2)) return 3;
  return 2;
}
export function assignSpecies(s: Score): Score {
  s.voices.forEach((v) => {
    v.species ??= assignedSpecies(s, v);
  });
  s.solution?.forEach((v) => {
    v.species ??= s.voices.find((w) => w.id === v.id)?.species;
  });
  return s;
}
export function upgradeScore(s: Score, catalog: Score[] = []): Score {
  const next = clone(s);
  const original = catalog.find(
    (c) =>
      c.id === s.path?.studyId ||
      c.id === s.source?.exerciseId ||
      (c.title === s.title && c.source?.url === s.source?.url),
  );
  if (original) {
    next.source = { ...original.source!, ...next.source };
    next.requirements ??= original.requirements;
    next.voices.forEach((v) => {
      v.species ??= original.voices.find((w) => w.id === v.id)?.species;
    });
  }
  assignSpecies(next);
  next.voices.forEach((voice) => clearSecondSpeciesTies(next, voice));
  return next;
}
/** Normalize student work, never the locked cantus or historical answer. */
export function clearSecondSpeciesTies(s: Score, voice: Voice) {
  if (voice.locked || assignedSpecies(s, voice) !== 2) return;
  for (const note of voice.notes) {
    if (note.tieStart) note.tieStart = false;
    if (note.tieStop) note.tieStop = false;
  }
}
export function solutionMatches(s: Score) {
  return (
    !!s.solution &&
    s.solution.length === s.voices.length &&
    s.voices.every((v, i) => {
      const answer = s.solution![i];
      // The student line omits the source's exceptional ties. It can still
      // use the original answer as a read-only model for the same slots.
      const species = assignedSpecies(s, v);
      const compareTies = v.locked || (species !== 2 &&
        (species !== 5 || v.notes.some((n) => n.tieStart || n.tieStop)));
      return (
        v.notes.length === answer.notes.length &&
        v.notes.every((n, j) => {
          const m = answer.notes[j];
          return (
            n.time === m.time &&
            n.duration === m.duration &&
            !!n.rest === !!m.rest &&
            (!compareTies ||
              (!!n.tieStart === !!m.tieStart && !!n.tieStop === !!m.tieStop)) &&
            (!v.locked || JSON.stringify(n.pitch) === JSON.stringify(m.pitch))
          );
        })
      );
    })
  );
}
export function blank(s: Score): Score {
  const b = assignSpecies(clone(s));
  b.id = crypto.randomUUID();
  b.solution = clone(s.voices);
  b.voices.forEach((v) => {
    if (!v.locked)
      v.notes.forEach((n) => {
        if (!n.rest) n.pitch = null;
        // Second species has fixed attacks. Florid students choose their own ties.
        if ([2, 5].includes(assignedSpecies(b, v))) {
          n.tieStart = false;
          n.tieStop = false;
        }
      });
  });
  return b;
}
export function parseKern(row: any): Score {
  const m = row.metadata;
  const voices: Voice[] = [];
  let parts: number[] = [];
  let times: number[] = [];
  for (const line of row.kern.split("\n")) {
    if (line.startsWith("*part")) {
      parts = line.split("\t").map((s: string) => Number(s.slice(5)));
      times = parts.map(() => 0);
      parts.forEach(
        (p) =>
          (voices[p - 1] = {
            id: `v${p}`,
            name: `Voice ${p}`,
            locked: p === m.cantus_firmus.part,
            notes: [],
          }),
      );
      continue;
    }
    if (!line || /^[!*=>]/.test(line)) continue;
    line.split("\t").forEach((token: string, i: number) => {
      if (token === "." || !parts[i]) return;
      const dur = token.match(/(\d+)(\.*)/);
      if (!dur) return;
      let duration = 8 / Number(dur[1]);
      for (let k = 0; k < dur[2].length; k++)
        duration += 8 / Number(dur[1]) / 2 ** (k + 1);
      const match = token.match(/([a-gA-G]+)/);
      let p: Pitch | null = null;
      if (match) {
        const x = match[1];
        p = {
          step: x[0].toUpperCase(),
          octave: x[0] === x[0].toLowerCase() ? 3 + x.length : 4 - x.length,
          alter: token.includes("n")
            ? 0
            : (token.match(/#/g) || []).length -
              (token.match(/-/g) || []).length,
        };
      }
      voices[parts[i] - 1].notes.push({
        id: `v${parts[i]}n${times[i]}`,
        time: times[i],
        duration,
        pitch: p,
        rest: token.includes("r"),
        tieStart: /[\[_]/.test(token),
        tieStop: /[\]_]/.test(token),
      });
      times[i] += duration;
    });
  }
  const bars = Math.round(Math.max(...times) / 8);
  return assignSpecies({
    version: 1,
    id: m.id,
    title: `Fux · Figure ${m.figure.number}${m.figure.corrected ? " (corrected)" : ""}`,
    species: Math.max(...m.species),
    mode: modes[["d", "e", "f", "g", "a", "c"].indexOf(m.modal_final)],
    bars,
    voices,
    source: {
      title: `Fux, Gradus ad Parnassum (1725), p. ${m.page}. Transcription: Gotham / Wilson, CC0.`,
      page: m.page,
      exerciseId: m.id,
      declaredSpecies: m.species,
      corrected: m.figure.corrected,
      editorialNotes: (m.source.review_notes || []).map(
        (n: any) => n.description,
      ),
      url: `https://github.com/MarkGotham/species/blob/${row.commit}/source_pdf/${m.source.pdf_file}`,
    },
  });
}
export function complete(s: Score) {
  return s.voices.every((v) => v.notes.every((n) => n.rest || n.pitch));
}
