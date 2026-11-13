import {
  at,
  complete,
  degree,
  midi,
  type Score,
  type Finding,
  type Note,
} from "./model";

export type Observation = { title: string; text: string; notes: string[] };
export type MusicalAnalysis = {
  voice: string;
  comparison?: string;
  partial: boolean;
  comparedAttacks: number;
  steps: number;
  leaps: number;
  repeats: number;
  stepPercent?: number;
  range?: number;
  high?: string;
  highBars: number[];
  recovered: number;
  thirdsSixths: number;
  intervals: number;
  contrary: number;
  similar: number;
  oblique: number;
  stationary: number;
  strengths: Observation[];
};
const intervalName = (n: number) =>
  n === 1
    ? "unison"
    : n === 8
      ? "octave"
      : `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
export { intervalName };

export function analyze(
  score: Score,
  selected: string,
  findings: Finding[],
): MusicalAnalysis {
  const voice =
    score.voices.find(
      (v) => !v.locked && v.notes.some((n) => n.id === selected),
    ) ||
    score.voices.find((v) => !v.locked) ||
    score.voices[0];
  const cantus = score.voices.find((v) => v.locked && v !== voice);
  const a: MusicalAnalysis = {
    voice: voice.name,
    comparison: cantus?.name,
    partial: !complete(score),
    comparedAttacks: 0,
    steps: 0,
    leaps: 0,
    repeats: 0,
    highBars: [],
    recovered: 0,
    thirdsSixths: 0,
    intervals: 0,
    contrary: 0,
    similar: 0,
    oblique: 0,
    stationary: 0,
    strengths: [],
  };
  const ns = voice.notes;
  const valid = (
    n: Note | undefined,
  ): n is Note & { pitch: NonNullable<Note["pitch"]> } => !!n?.pitch && !n.rest;
  const contiguous = (p: Note, n: Note) => p.time + p.duration === n.time;
  const affectedError = (ids: string[], relevantRules?: string[]) =>
    findings.some(
      (f) =>
        (f.severity === "error" || f.basis === "review") &&
        (!relevantRules ||
          relevantRules.includes(f.rule) ||
          f.basis === "review") &&
        f.notes.some((id) => ids.includes(id)),
    );
  for (let i = 1; i < ns.length; i++) {
    const p = ns[i - 1],
      n = ns[i];
    if (!valid(p) || !valid(n) || !contiguous(p, n) || n.tieStop) continue;
    a.comparedAttacks++;
    const d = degree(n.pitch) - degree(p.pitch);
    if (!d && midi(n.pitch) === midi(p.pitch)) a.repeats++;
    else if (Math.abs(d) <= 1) a.steps++;
    else {
      a.leaps++;
      // Follow a held arrival through its tie before examining the next attack.
      let j = i;
      while (
        j + 1 < ns.length &&
        ns[j].tieStart &&
        ns[j + 1].tieStop &&
        valid(ns[j + 1]) &&
        contiguous(ns[j], ns[j + 1]) &&
        midi(ns[j].pitch!) === midi(ns[j + 1].pitch!)
      )
        j++;
      const q = ns[j + 1];
      if (valid(q) && !q.tieStop && contiguous(ns[j], q)) {
        const recovery = degree(q.pitch) - degree(n.pitch);
        if (Math.abs(recovery) === 1 && Math.sign(recovery) !== Math.sign(d)) {
          a.recovered++;
          const ids = [p.id, ...ns.slice(i, j + 1).map((n) => n.id), q.id];
          if (!affectedError(ids, ["melodic-interval", "leap-recovery"]))
            a.strengths.push({
              title: "Leap answered by step",
              text: `The leap at bar ${Math.floor(n.time / 8) + 1} is followed by a step in the opposite direction, bringing the line back toward its earlier register.`,
              notes: ids,
            });
        }
      }
    }
  }
  if (a.steps + a.leaps)
    a.stepPercent = Math.round((a.steps / (a.steps + a.leaps)) * 100);
  const written = ns.filter(valid);
  if (written.length) {
    const ds = written.map((n) => degree(n.pitch));
    a.range = Math.max(...ds) - Math.min(...ds) + 1;
    const highestMidi = Math.max(...written.map((n) => midi(n.pitch)));
    const highs = written.filter((n) => midi(n.pitch) === highestMidi);
    a.high = `${highs[0].pitch.step}${highs[0].pitch.alter === 1 ? "♯" : highs[0].pitch.alter === -1 ? "♭" : ""}${highs[0].pitch.octave}`;
    a.highBars = [
      ...new Set(
        highs.filter((n) => !n.tieStop).map((n) => Math.floor(n.time / 8) + 1),
      ),
    ];
  }
  if (cantus)
    for (let t = 0; t < score.bars * 8; t += 8) {
      const n = at(voice, t),
        c = at(cantus, t);
      if (!valid(n) || !valid(c)) continue;
      a.intervals++;
      if (
        [3, 6].includes((Math.abs(degree(n.pitch) - degree(c.pitch)) % 7) + 1)
      )
        a.thirdsSixths++;
      if (!t) continue;
      const p = at(voice, t - 8),
        pc = at(cantus, t - 8);
      if (!valid(p) || !valid(pc)) continue;
      // Missing notes or rests between samples break the motion comparison.
      if (
        [voice, cantus].some((v) =>
          v.notes.some((x) => x.time > t - 8 && x.time < t && !valid(x)),
        )
      )
        continue;
      const d = Math.sign(midi(n.pitch) - midi(p.pitch)),
        dc = Math.sign(midi(c.pitch) - midi(pc.pitch));
      if (!d && !dc) a.stationary++;
      else if (!d || !dc) a.oblique++;
      else if (d === dc) a.similar++;
      else {
        a.contrary++;
        const ids = [p.id, n.id, pc.id, c.id];
        // This is a local observation about direction, independent of harmony errors.
        a.strengths.push({
          title: "Voices move in opposite directions",
          text: `Across bars ${t / 8}–${t / 8 + 1}, ${voice.name} and ${cantus.name} move in contrary motion, giving the parts separate directions.`,
          notes: ids,
        });
      }
    }
  for (let i = 1; i < ns.length; i++) {
    const p = ns[i - 1],
      n = ns[i],
      q = ns[i + 1];
    const ids = [p.id, n.id, ...(q ? [q.id] : [])];
    if (
      valid(p) &&
      valid(n) &&
      p.tieStart &&
      n.tieStop &&
      contiguous(p, n) &&
      degree(p.pitch) === degree(n.pitch) &&
      midi(p.pitch) === midi(n.pitch) &&
      valid(q) &&
      contiguous(n, q) &&
      !affectedError(ids) &&
      !findings.some((f) => f.rule === "checking")
    ) {
      // Require known harmony across preparation, continuation and resolution.
      if (
        score.voices.every((v) =>
          [p.time, n.time, q.time].every((t) => valid(at(v, t))),
        )
      )
        a.strengths.push({
          title: "Prepared tied continuation",
          text: `The tie into bar ${Math.floor(n.time / 8) + 1} retains its pitch; its preparation and following note pass the current contextual checks.`,
          notes: ids,
        });
    }
  }
  // Keep a concise set of distinct, inspectable observations.
  a.strengths = a.strengths.filter(
    (x, i, xs) => xs.findIndex((y) => y.title === x.title) === i,
  );
  return a;
}
