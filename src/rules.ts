import { extendedTieNotes } from "./ties.ts";
import {
  type Score,
  type Note,
  type Finding,
  type Voice,
  midi,
  degree,
  at,
  complete,
  assignedSpecies,
  label,
} from "./model.ts";
import { explainFindings } from "./teaching.ts";
export const source =
  "Fux, Gradus ad Parnassum (1725), Book II: melodic motion and the five species; local interpretation in Sources.";
export function interval(a: Note, b: Note) {
  const x = a.pitch!,
    y = b.pitch!;
  return {
    diatonic: (Math.abs(degree(x) - degree(y)) % 7) + 1,
    semitones: Math.abs(midi(x) - midi(y)) % 12,
  };
}
export function consonant(a: Note, b: Note, upperPair = false) {
  const i = interval(a, b);
  return (
    (i.diatonic === 1 && i.semitones === 0) ||
    (i.diatonic === 3 && [3, 4].includes(i.semitones)) ||
    (i.diatonic === 5 && i.semitones === 7) ||
    (i.diatonic === 6 && [8, 9].includes(i.semitones)) ||
    (upperPair &&
      ((i.diatonic === 4 && i.semitones === 5) ||
        ([4, 5].includes(i.diatonic) && i.semitones === 6)))
  );
}
/** The leading-tone diminished fifth in the fuller cadential texture (Fux p.96).
 * Both voices must make its characteristic stepwise resolution; missing finals wait.
 */
function cadentialFifth(
  s: Score,
  a: Note,
  b: Note,
  time: number,
): "yes" | "pending" | "no" {
  const end = (s.bars - 1) * 8;
  const iv = interval(a, b);
  if (
    s.voices.length < 3 ||
    time < end - 4 ||
    time >= end ||
    iv.diatonic !== 5 ||
    iv.semitones !== 6
  )
    return "no";
  const [low, high] = midi(a.pitch!) < midi(b.pitch!) ? [a, b] : [b, a];
  const final = s.voices.find((v) => v.locked)?.notes.at(-1)?.pitch;
  if (!final || (midi(low.pitch!) - midi(final) + 120) % 12 !== 11) return "no";
  if (
    s.voices.some((v) => {
      const n = at(v, time);
      return n?.pitch && !n.rest && midi(n.pitch) < midi(low.pitch!);
    })
  )
    return "no";
  const lowVoice = s.voices.find((v) => v.notes.includes(low))!,
    highVoice = s.voices.find((v) => v.notes.includes(high))!;
  const l = at(lowVoice, end),
    h = at(highVoice, end);
  if ((!l?.pitch && !l?.rest) || (!h?.pitch && !h?.rest)) return "pending";
  return l?.pitch &&
    h?.pitch &&
    !l.rest &&
    !h.rest &&
    midi(l.pitch) - midi(low.pitch!) === 1 &&
    degree(h.pitch) - degree(high.pitch!) === -1 &&
    interval(l, h).diatonic === 3 &&
    interval(l, h).semitones === 4
    ? "yes"
    : "no";
}
/** Only unwritten voices below the current bass can leave its role unknown.
 * Written crossings still use the actual lowest sounding pitch.
 */
function unknownBass(s: Score, time: number): boolean {
  let bassIndex = -1;
  let bassMidi = Infinity;
  s.voices.forEach((v, i) => {
    const n = at(v, time);
    if (n?.pitch && !n.rest && midi(n.pitch) <= bassMidi) {
      bassIndex = i;
      bassMidi = midi(n.pitch);
    }
  });
  return s.voices.some((v, i) => {
    const n = at(v, time);
    return i > bassIndex && !!n && !n.pitch && !n.rest;
  });
}
/** Consonance at an anchor's own time; unknown harmony must stay unknown. */
function anchorConsonance(
  s: Score,
  a: Note,
  other: Voice,
): boolean | undefined {
  const b = at(other, a.time);
  if (b?.rest) return true;
  if (!a.pitch || !b?.pitch) return undefined;
  const notes = s.voices.map((v) => at(v, a.time));
  const bass = Math.min(
    ...notes.filter((n) => n?.pitch && !n.rest).map((n) => midi(n!.pitch!)),
  );
  const upper =
    s.voices.length > 2 && midi(a.pitch) > bass && midi(b.pitch) > bass;
  if (consonant(a, b, upper)) return true;
  if (unknownBass(s, a.time) && consonant(a, b, true)) return undefined;
  const cadence = cadentialFifth(s, a, b, a.time);
  return cadence === "pending" ? undefined : cadence === "yes";
}
function baseCheck(s: Score): Finding[] {
  const out: Finding[] = [];
  const add = (
    rule: string,
    message: string,
    ns: Note[],
    severity: "error" | "suggestion" = "error",
  ) =>
    out.push({ rule, message, notes: ns.map((n) => n.id), severity, source });
  const melodic = s.cantusOnly ? s.voices : s.voices.filter((v) => !v.locked);
  for (const v of melodic) {
    const species = assignedSpecies(s, v);
    for (let k = 0; k < v.notes.length; k++) {
      const n = v.notes[k],
        prev = v.notes[k - 1],
        next = v.notes[k + 1];
      if (!n.pitch || n.rest) continue;
      if (
        n.tieStop &&
        prev?.pitch &&
        (midi(prev.pitch) !== midi(n.pitch) ||
          degree(prev.pitch) !== degree(n.pitch))
      )
        add("tie", "Tied notes must retain the same pitch.", [prev, n]);
      if (n.tieStop && prev?.rest)
        add("tie", "A rest cannot prepare a tied note.", [prev, n]);
      if (n.tieStop && !prev?.tieStart)
        add("tie", "This tie has no preparation.", [n]);
      if (
        n.tieStart &&
        next?.pitch &&
        (!next.tieStop ||
          midi(next.pitch) !== midi(n.pitch) ||
          degree(next.pitch) !== degree(n.pitch))
      )
        add("tie", "Continue the tie at the same pitch.", [n, next]);
      if (prev?.pitch && !prev.rest && !n.tieStop) {
        const d = degree(n.pitch) - degree(prev.pitch),
          c = midi(n.pitch) - midi(prev.pitch);
        const allowed =
          [0, 1, 2, 3, 4, 7].includes(Math.abs(d)) ||
          (Math.abs(d) === 5 && Math.abs(c) === 8);
        const size = Math.abs(d),
          semi = Math.abs(c);
        const validQuality: Record<number, number[]> = {
          0: [0],
          1: [1, 2],
          2: [3, 4],
          3: [5],
          4: [7],
          5: [8],
          7: [12],
        };
        if (d === 0 && semi === 1)
          add(
            "chromatic-motion",
            "This voice changes the inflection of one note name. Review the modal and cross-relation context before judging it.",
            [prev, n],
            "suggestion",
          );
        else if (!allowed || !validQuality[size]?.includes(semi))
          add(
            "melodic-interval",
            "Use singable steps and consonant leaps; avoid sevenths, tritones, and augmented intervals.",
            [prev, n],
          );
        if (d === 0 && species > 1 && s.voices.length === 2)
          add(
            "repetition",
            "Prefer movement rather than repeated notes in this species.",
            [prev, n],
            "suggestion",
          );
      }
    }
  }
  const modalSteps: Record<string, number[]> = {
    Dorian: [0, 2, 3, 5, 7, 9, 10],
    Phrygian: [0, 1, 3, 5, 7, 8, 10],
    Lydian: [0, 2, 4, 6, 7, 9, 11],
    Mixolydian: [0, 2, 4, 5, 7, 9, 10],
    Aeolian: [0, 2, 3, 5, 7, 8, 10],
    Ionian: [0, 2, 4, 5, 7, 9, 11],
  };
  const modalFinal = s.voices.find((v) => v.locked)?.notes.at(-1)?.pitch;
  const finalPC = modalFinal
    ? midi(modalFinal) % 12
    : ({
        Dorian: 2,
        Phrygian: 4,
        Lydian: 5,
        Mixolydian: 7,
        Aeolian: 9,
        Ionian: 0,
      }[s.mode] ?? 2);
  for (const v of melodic)
    for (let k = 0; k < v.notes.length; k++) {
      const n = v.notes[k],
        next = v.notes[k + 1];
      if (!n.pitch || n.rest) continue;
      const relative = (midi(n.pitch) - finalPC + 120) % 12;
      const borrowed =
        (s.mode === "Dorian" && relative === 8) ||
        (s.mode === "Lydian" && relative === 5);
      const cadential =
        relative === 11 &&
        s.mode !== "Phrygian" &&
        ((next && !next.pitch && !next.rest) ||
          (next?.pitch && midi(next.pitch) - midi(n.pitch) === 1));
      const picardy =
        (n.time === 0 || n.time >= (s.bars - 1) * 8) &&
        relative === 4 &&
        s.voices.length > 2;
      if (
        !modalSteps[s.mode]?.includes(relative) &&
        !borrowed &&
        !cadential &&
        !picardy
      )
        add(
          "mode",
          "This pitch is outside the selected mode. Check whether a cadential inflection or musica ficta justifies it.",
          [n],
          "suggestion",
        );
      if (
        assignedSpecies(s, v) === 1 &&
        n.duration !== 8 &&
        !(s.voices.length > 2 && s.species > 1 && n.duration === 4)
      )
        add(
          "species-rhythm",
          "First species uses one whole note per cantus note.",
          [n],
        );
    }
  if (s.voices.length > 2)
    for (let t = 0; t < s.bars * 8; t += 8) {
      const ns = s.voices.map((v) => at(v, t));
      if (ns.some((n) => !n?.pitch || n.rest)) continue;
      const bass = (ns as Note[]).reduce((a, b) =>
        midi(a.pitch!) < midi(b.pitch!) ? a : b,
      );
      const upper = ns.filter((n) => n !== bass) as Note[];
      if (
        t > 0 &&
        t < (s.bars - 1) * 8 &&
        // Fullness is advice about a consonant sonority. A suspension's
        // transient dissonance is judged by its preparation and resolution,
        // not by requiring a third or sixth at the suspended downbeat.
        ns.every((a, i) =>
          ns
            .slice(i + 1)
            .every((b) => consonant(a!, b!, a !== bass && b !== bass)),
        ) &&
        !upper.some((n) => [3, 6].includes(interval(n, bass).diatonic))
      )
        add(
          "full-sonority",
          "Consider including a third or sixth above the bass for a fuller sonority.",
          ns as Note[],
          "suggestion",
        );
      const leading = ns.filter(
        (n) => n?.pitch && (midi(n.pitch) - finalPC + 120) % 12 === 11,
      );
      if (s.mode !== "Phrygian" && leading.length > 1)
        add(
          "doubled-leading-tone",
          "Avoid doubling the raised leading tone.",
          leading as Note[],
        );
    }
  if (s.cantusOnly) {
    const ns = s.voices[0].notes;
    const finals: Record<string, string> = {
      Dorian: "D",
      Phrygian: "E",
      Lydian: "F",
      Mixolydian: "G",
      Aeolian: "A",
      Ionian: "C",
    };
    for (const n of [ns[0], ns.at(-1)!])
      if (n?.pitch && (n.pitch.step !== finals[s.mode] || n.pitch.alter !== 0))
        add("modal-final", "Begin and end on the final of the selected mode.", [
          n,
        ]);
    if (
      complete(s) &&
      ns[0]?.pitch &&
      ns.at(-1)?.pitch &&
      midi(ns[0].pitch) !== midi(ns.at(-1)!.pitch!)
    )
      add(
        "cantus-final",
        "Begin and end on the modal final in the same octave.",
        [ns[0], ns.at(-1)!],
      );
    const last = ns.at(-1),
      penult = ns.at(-2);
    if (
      last?.pitch &&
      penult?.pitch &&
      !last.rest &&
      !penult.rest &&
      Math.abs(degree(last.pitch) - degree(penult.pitch)) !== 1
    )
      add(
        "cantus-cadence",
        "Approach the final by step to give this cantus a clear ending.",
        [penult, last],
        s.requirements?.stepwiseCantusEnding ? "error" : "suggestion",
      );
    return out;
  }
  const ts = [
    ...new Set(s.voices.flatMap((v) => v.notes.map((n) => n.time))),
  ].sort((a, b) => a - b);
  for (let a = 0; a < s.voices.length; a++)
    for (let b = a + 1; b < s.voices.length; b++) {
      const va = s.voices[a],
        vb = s.voices[b];
      if (va.locked && vb.locked) continue;
      let previous: { x: Note; y: Note; t: number } | undefined;
      const pairSpecies = Math.max(
        assignedSpecies(s, va),
        assignedSpecies(s, vb),
      );
      if (pairSpecies === 2 || pairSpecies === 3)
        for (let t = 8; t < s.bars * 8; t += 8) {
          const p = at(va, t - 8),
            q = at(vb, t - 8),
            x = at(va, t),
            y = at(vb, t);
          if (
            !p?.pitch ||
            !q?.pitch ||
            !x?.pitch ||
            !y?.pitch ||
            [p, q, x, y].some((n) => n.rest)
          )
            continue;
          const a = interval(p, q),
            b = interval(x, y);
          if (a.semitones !== b.semitones || ![0, 7].includes(b.semitones))
            continue;
          const dx = midi(x.pitch) - midi(p.pitch),
            dy = midi(y.pitch) - midi(q.pitch);
          const bridge = [va, vb].some((v) => {
            const ns = v.notes.filter(
              (n) => n.time >= t - 8 && n.time <= t && n.pitch && !n.rest,
            );
            return ns.some(
              (n, i) =>
                i > 0 &&
                Math.abs(degree(n.pitch!) - degree(ns[i - 1].pitch!)) >= 3,
            );
          });
          if (dx && dy && Math.sign(dx) === Math.sign(dy) && !bridge)
            add(
              "downbeat-parallels",
              "These downbeats form successive perfect intervals. In two-voice second species, a small intervening step or third does not hide the parallel; larger leaps and fuller textures need context.",
              [p, q, x, y],
              pairSpecies === 2 && s.voices.length === 2
                ? "error"
                : "suggestion",
            );
        }
      for (const t of ts) {
        const x = at(va, t),
          y = at(vb, t);
        if (!x?.pitch || !y?.pitch || x.rest || y.rest) {
          previous = undefined;
          continue;
        }
        const sounding = s.voices
          .map((v) => at(v, t))
          .filter((n) => n?.pitch && !n.rest) as Note[];
        const bassMidi = Math.min(...sounding.map((n) => midi(n.pitch!)));
        const upperPair =
          s.voices.length > 2 &&
          (unknownBass(s, t) ||
            (midi(x.pitch) > bassMidi && midi(y.pitch) > bassMidi));
        if (interval(x, y).diatonic === 1 && interval(x, y).semitones !== 0) {
          add(
            "chromatic-clash",
            "A note and its altered form sound together here. Keep the spelling and sounding pitch consistent between the voices.",
            [x, y],
          );
        } else if (
          !consonant(x, y, upperPair) &&
          cadentialFifth(s, x, y, t) === "no"
        ) {
          const moving = [
            { n: x, v: va },
            { n: y, v: vb },
          ]
            .filter((z) => z.n.time === t && !z.v.locked)
            .sort((a, b) => a.n.duration - b.n.duration)[0];
          const sus = [
            { n: x, v: va },
            { n: y, v: vb },
          ].find(
            (z) =>
              z.n.tieStop && Math.floor(z.n.time / 8) === Math.floor(t / 8),
          );
          const candidate = sus || moving;
          let allowed = false,
            pending = false;
          if (candidate) {
            const { n, v } = candidate,
              k = v.notes.indexOf(n),
              p = v.notes[k - 1],
              q = v.notes[k + 1];
            const species = assignedSpecies(s, v);
            const bassAt = (time: number) => {
              const notes = s.voices.map((v) => at(v, time));
              if (notes.some((n) => !n?.pitch || n.rest)) return undefined;
              return (notes as Note[]).reduce((a, b) =>
                midi(a.pitch!) < midi(b.pitch!) ? a : b,
              );
            };
            const stationaryBass = (a: number, b: number) => {
              const p = bassAt(a),
                q = bassAt(b);
              if (s.voices.length <= 2) return false;
              if (!p || !q) return undefined;
              return (
                !!p?.pitch &&
                !!q?.pitch &&
                midi(p.pitch) === midi(q.pitch) &&
                midi(n.pitch!) > midi(p.pitch)
              );
            };
            // An untied downbeat cannot become a passing tone when more notes
            // are entered. Only defer treatments that can use that context.
            pending =
              (t % 8 !== 0 || !!n.tieStart || !!sus) &&
              ((!q?.pitch && !q?.rest) || (!p?.pitch && !p?.rest));
            if (pending && !sus && !n.tieStart) {
              const other = v === va ? vb : va;
              const usable = (a: Note | undefined) =>
                !!a && !a.rest && anchorConsonance(s, a, other) !== false;
              const d1 = p?.pitch
                ? degree(n.pitch!) - degree(p.pitch)
                : undefined;
              const d2 = q?.pitch
                ? degree(q.pitch) - degree(n.pitch!)
                : undefined;
              const step = (d: number | undefined) =>
                d === undefined || Math.abs(d) === 1;
              const passing =
                step(d1) &&
                step(d2) &&
                (d1 === undefined || d2 === undefined || d1 === d2);
              const neighbour =
                species >= 3 &&
                n.duration === 2 &&
                [2, 6].includes(n.time % 8) &&
                step(d1) &&
                step(d2) &&
                (d1 === undefined || d2 === undefined || d1 === -d2);
              const r = v.notes[k + 2];
              const cambiata =
                [3, 5].includes(species) &&
                n.duration === 2 &&
                n.time % 8 === 2 &&
                (d1 === undefined || d1 === -1) &&
                (d2 === undefined || d2 === -2) &&
                usable(r) &&
                (!q?.pitch ||
                  !r?.pitch ||
                  degree(r.pitch) - degree(q.pitch) === 1);
              const eighth =
                species === 5 &&
                n.duration === 1 &&
                !!p &&
                !p.rest &&
                !!q &&
                !q.rest &&
                step(d1) &&
                step(d2);
              pending =
                species !== 1 &&
                species !== 4 &&
                t % 8 !== 0 &&
                (eighth ||
                  (usable(p) &&
                    usable(q) &&
                    (passing || neighbour || cambiata)));
            }
            if (
              n.tieStart &&
              q?.tieStop &&
              q.pitch &&
              midi(q.pitch) === midi(n.pitch!) &&
              stationaryBass(n.time, q.time) !== false
            ) {
              const r = v.notes[k + 2];
              pending =
                stationaryBass(n.time, q.time) === undefined ||
                (!!r && !r.pitch && !r.rest);
              const harmony = r?.pitch
                ? anchorConsonance(s, r, v === va ? vb : va)
                : undefined;
              if (harmony === undefined) pending = true;
              allowed =
                !!r?.pitch &&
                stationaryBass(n.time, q.time) === true &&
                degree(r.pitch) - degree(n.pitch!) === -1 &&
                harmony === true;
            } else if (sus && p?.pitch && q?.pitch) {
              const otherVoice = v === va ? vb : va;
              const preparation = anchorConsonance(s, p, otherVoice);
              const successors = v.notes
                .slice(k + 1)
                .filter(
                  (r) => r.time <= n.time + (species === 5 ? 6 : n.duration),
                );
              const resolution = successors.find(
                (r) =>
                  r.pitch &&
                  degree(r.pitch) - degree(n.pitch!) === -1 &&
                  anchorConsonance(s, r, otherVoice) === true,
              );
              pending =
                preparation === undefined ||
                stationaryBass(p.time, n.time) === undefined ||
                successors.some(
                  (r) =>
                    !r.rest &&
                    (!r.pitch ||
                      anchorConsonance(s, r, otherVoice) === undefined),
                );
              const ornaments = resolution
                ? successors.filter((r) => r.time < resolution.time)
                : [];
              allowed = !!(
                p.tieStart &&
                midi(p.pitch) === midi(n.pitch!) &&
                (preparation === true || stationaryBass(p.time, n.time)) &&
                resolution &&
                ornaments.every(
                  (r) => r.pitch && anchorConsonance(s, r, otherVoice) === true,
                )
              );
            } else if (t % 8 !== 0 && p?.pitch && q?.pitch) {
              const d1 = degree(n.pitch!) - degree(p.pitch),
                d2 = degree(q.pitch) - degree(n.pitch!);
              const otherVoice = v === va ? vb : va;
              const anchor = (a: Note) => anchorConsonance(s, a, otherVoice);
              const quarter = n.duration === 2;
              const neighbourBeat = n.time % 8 === 2 || n.time % 8 === 6;
              const passing = Math.abs(d1) === 1 && d1 === d2;
              const neighbour =
                species >= 3 &&
                quarter &&
                neighbourBeat &&
                Math.abs(d1) === 1 &&
                d1 === -d2 &&
                midi(p.pitch) === midi(q.pitch);
              const eighth =
                species === 5 &&
                n.duration === 1 &&
                Math.abs(d1) === 1 &&
                Math.abs(d2) === 1;
              const ap = anchor(p),
                aq = anchor(q);
              if (
                (passing || neighbour) &&
                (ap === undefined || aq === undefined)
              )
                pending = true;
              allowed =
                species !== 4 &&
                (eighth ||
                  ((passing || neighbour) && ap === true && aq === true));
              if (
                (species === 3 || species === 5) &&
                quarter &&
                n.time % 8 === 2 &&
                d1 === -1 &&
                d2 === -2 &&
                ap !== false &&
                aq !== false
              ) {
                const r = v.notes[k + 2];
                pending =
                  !r?.pitch ||
                  ap === undefined ||
                  aq === undefined ||
                  (!!r?.pitch && anchor(r) === undefined);
                allowed =
                  !!r?.pitch &&
                  degree(r.pitch) - degree(q.pitch) === 1 &&
                  ap === true &&
                  aq === true &&
                  anchor(r) === true;
              }
            }
          }
          // Missing resolution notes cannot repair a disproven preparation.
          if (pending && sus) {
            const { n, v } = sus;
            const k = v.notes.indexOf(n),
              p = v.notes[k - 1],
              q = v.notes[k + 1];
            const other = v === va ? vb : va;
            if (
              !p?.tieStart ||
              p.rest ||
              (p.pitch &&
                (midi(p.pitch) !== midi(n.pitch!) ||
                  degree(p.pitch) !== degree(n.pitch!))) ||
              (p.pitch &&
                anchorConsonance(s, p, other) === false &&
                s.voices.length === 2) ||
              (assignedSpecies(s, v) === 4 &&
                (q?.rest ||
                  (q?.pitch && degree(q.pitch) - degree(n.pitch!) !== -1)))
            )
              pending = false;
          }
          if (
            s.species === 1 ||
            (candidate && assignedSpecies(s, candidate.v) === 1 && !sus)
          ) {
            allowed = false;
            pending = false;
          }
          if (!allowed && !pending) {
            const species = candidate
              ? assignedSpecies(s, candidate.v)
              : s.species;
            const message =
              t % 8 === 0
                ? "This downbeat dissonance needs a prepared suspension resolving down by step."
                : species === 2
                  ? "This weak-half dissonance must pass by step in the same direction between two consonances."
                  : species === 3 && t % 8 === 4
                    ? "On the third quarter, a dissonance must pass by step in the same direction between consonant second and fourth quarters. A neighbour that turns back is not allowed here."
                    : species === 3 && t % 8 === 2
                      ? "On the second quarter, use a passing tone by step in the same direction, a neighbour that steps away and returns, or the descending cambiata; keep the surrounding anchors consonant."
                      : species === 3 && t % 8 === 6
                        ? "On the fourth quarter, use a passing tone by step in the same direction or a neighbour that steps away and returns; both surrounding notes must be consonant."
                        : "Use a supported passing, neighbour or cambiata figure, or a prepared suspension; check its beat, note value and consonant anchors.";
            add("dissonance", message, [x, y]);
          }
        }
        if (midi(x.pitch) < midi(y.pitch))
          add(
            "crossing",
            "These voices cross. Check that their independence remains clear.",
            [x, y],
            "suggestion",
          );
        if (previous && previous.x.pitch && previous.y.pitch) {
          const ix = interval(previous.x, previous.y),
            iy = interval(x, y);
          const dx = midi(x.pitch) - midi(previous.x.pitch),
            dy = midi(y.pitch) - midi(previous.y.pitch);
          if (
            dx &&
            dy &&
            Math.sign(dx) === Math.sign(dy) &&
            [0, 7].includes(iy.semitones) &&
            ix.semitones === iy.semitones
          )
            add(
              "parallels",
              "Parallel perfect fifths or octaves weaken the independence of these voices.",
              [previous.x, previous.y, x, y],
            );
          else if (
            dx &&
            dy &&
            Math.sign(dx) === Math.sign(dy) &&
            [0, 7].includes(iy.semitones) &&
            (s.voices.length > 2 ||
              Math.abs(degree(x.pitch) - degree(previous.x.pitch)) > 1)
          )
            add(
              "direct-perfect",
              s.voices.length > 2
                ? "Similar motion into a perfect interval: prefer contrary or oblique motion. In three or more voices, review whether a contextual exception is needed, even when the upper voice moves by step."
                : "Similar motion into a perfect interval: try contrary motion or a step in the upper voice.",
              [previous.x, previous.y, x, y],
              "suggestion",
            );
        }
        previous = { x, y, t };
      }
    }
  if (s.voices.length === 2) {
    const [v, w] = s.voices;
    const last = s.bars * 8 - 8;
    for (const t of [0, last]) {
      const x = at(v, t),
        y = at(w, t);
      if (x?.pitch && y?.pitch && !x.rest && !y.rest) {
        const i = interval(x, y);
        if (
          !(t === 0
            ? s.voices[0].locked
              ? i.semitones === 0
              : [0, 7].includes(i.semitones)
            : i.semitones === 0)
        )
          add(
            "boundary",
            t === 0
              ? "Begin on a perfect consonance."
              : "End on a unison or octave.",
            [x, y],
          );
      }
    }
    const cf = s.voices.find((v) => v.locked),
      cp = s.voices.find((v) => !v.locked);
    if (cf && cp) {
      const end = cp.notes.at(-1),
        p = cp.notes.at(-2);
      if (end?.pitch && p?.pitch) {
        if (Math.abs(degree(end.pitch) - degree(p.pitch)) !== 1)
          add("cadence", "Approach the final by step.", [p, end]);
        else if (
          s.mode !== "Phrygian" &&
          midi(end.pitch) > midi(p.pitch) &&
          midi(end.pitch) - midi(p.pitch) !== 1
        )
          add("leading-tone", "Raise the leading tone at the cadence.", [
            p,
            end,
          ]);
      }
    }
  }
  return [...new Map(out.map((f) => [f.rule + f.notes.join(","), f])).values()];
}

export const RULE_VERSION = "fux-1725-v9";
export function check(s: Score): Finding[] {
  const out = baseCheck(s);
  const add = (
    rule: string,
    message: string,
    notes: Note[],
    severity: "error" | "suggestion" = "error",
  ) =>
    out.push({
      rule,
      message,
      notes: notes.map((n) => n.id),
      severity,
      source:
        rule === "direct-perfect"
          ? "Fux (1725), Book I, pp. 41–42: four rules of motion; Book II, First Exercise, first species."
          : `Fux (1725), Book II, ${s.voices.length === 2 ? "First" : s.voices.length === 3 ? "Second" : "Third"} Exercise, species ${s.species}. See RULES.md for scope and exceptions.`,
    });
  const vs = s.cantusOnly ? s.voices : s.voices.filter((v) => !v.locked);
  for (const v of vs) {
    const species = assignedSpecies(s, v);
    let run: Note[] = [];
    for (let i = 0; i < v.notes.length; i++) {
      const n = v.notes[i],
        p = v.notes[i - 1];
      if (!n.pitch || n.rest) {
        run = [];
        continue;
      }
      const last = n.time >= (s.bars - 1) * 8,
        penultimate = n.time >= (s.bars - 2) * 8;
      if (
        species === 2 &&
        !last &&
        n.duration !== 4 &&
        !(s.voices.length > 2 && n.duration === 8) &&
        !(penultimate && n.duration === 8)
      )
        add(
          "species-rhythm",
          "Second species uses two half notes against a whole note, with the documented cadential exception.",
          [n],
        );
      if (
        species === 3 &&
        !last &&
        n.duration !== 2 &&
        !(s.voices.length > 2 && n.duration === 8)
      )
        add(
          "species-rhythm",
          "Third species uses four quarter notes against the cantus whole note.",
          [n],
        );
      if (species === 4 && !last && ![4, 8].includes(n.duration))
        add(
          "species-rhythm",
          "Fourth species uses half-note syncopations and prepared ties.",
          [n],
        );
      if (n.tieStop) continue;
      if (
        p?.pitch &&
        !p.rest &&
        midi(p.pitch) === midi(n.pitch) &&
        !n.tieStop
      ) {
        if (!run.length) run = [p];
        run.push(n);
        if (s.voices.length <= 2 && (species > 1 || run.length >= 3))
          add(
            "repetition",
            species === 1
              ? "This repeated pitch stalls the line. Fux's corrected Figure 15 retains three attacks, so treat this as advice about shape rather than an unconditional prohibition."
              : species === 5
                ? "This florid note is rearticulated. Fux retains such figures in the fifth-species models; consider whether a tie or a new pitch would make this phrase clearer."
                : "Repeated attacks interrupt this species. Use movement or a properly notated suspension.",
            run,
            species === 1 || species === 5 ? "suggestion" : "error",
          );
      } else run = [n];
      if (n.duration === 1 && species === 5) {
        const prev = v.notes[i - 1],
          next = v.notes[i + 1];
        if (n.time % 4 !== 2 && n.time % 4 !== 3)
          add(
            "eighth-placement",
            "Place eighth-note pairs on the second or fourth quarter of the bar.",
            [n],
            "suggestion",
          );
        const after = v.notes[i + 2];
        const turnHarmony = s.voices
          .filter((w) => w !== v)
          .map((other): boolean | undefined => {
            const b = at(other, n.time);
            if (b?.rest) return true;
            if (!b?.pitch) return undefined;
            const notes = s.voices.map((w) => at(w, n.time));
            const bass = Math.min(
              ...notes
                .filter((x) => x?.pitch && !x.rest)
                .map((x) => midi(x!.pitch!)),
            );
            if (consonant(n, b, midi(n.pitch!) > bass && midi(b.pitch) > bass))
              return true;
            if (
              notes.some((x) => x && !x.pitch && !x.rest) &&
              consonant(n, b, true)
            )
              return undefined;
            return false;
          });
        const possibleTurn =
          !!prev?.pitch &&
          !prev.rest &&
          !!next &&
          !next.rest &&
          !!after &&
          !after.rest &&
          next.duration === 1 &&
          degree(n.pitch) - degree(prev.pitch) === -2 &&
          (!next.pitch || degree(next.pitch) - degree(n.pitch) === 1) &&
          (!after.pitch ||
            (midi(after.pitch) === midi(prev.pitch) &&
              (!next.pitch ||
                degree(after.pitch) - degree(next.pitch) === 1))) &&
          turnHarmony.every((h) => h !== false);
        const turn =
          possibleTurn &&
          !!next?.pitch &&
          !!after?.pitch &&
          turnHarmony.every((h) => h === true);
        const pendingTurn =
          possibleTurn &&
          (!next?.pitch ||
            !after?.pitch ||
            turnHarmony.some((h) => h === undefined));
        if (
          prev?.pitch &&
          Math.abs(degree(n.pitch) - degree(prev.pitch)) !== 1 &&
          !turn &&
          !pendingTurn
        )
          add("eighth-step", "Enter an eighth note by step.", [prev, n]);
        if (next?.pitch && Math.abs(degree(next.pitch) - degree(n.pitch)) !== 1)
          add("eighth-step", "Leave an eighth note by step.", [n, next]);
      }
    }
    if ([4, 5].includes(species))
      for (const n of extendedTieNotes(v)) {
        if (n.pitch)
          add(
            "extended-tie",
            species === 4
              ? "Fourth species releases the tied pair before preparing another suspension."
              : "This extended florid hold needs source context; it is outside the documented study pattern.",
            [
              v.notes[v.notes.indexOf(n) - 1],
              n,
              v.notes[v.notes.indexOf(n) + 1],
            ],
            species === 4 ? "error" : "suggestion",
          );
      }
    if (species === 4) {
      const moving = v.notes.some((n) => n.tieStart || n.tieStop);
      const entered = v.notes.some((n) => n.pitch && !n.rest);
      if (!moving && entered)
        add(
          "suspension-chain",
          "Fourth species needs a chain of half notes tied across the barlines. Untied half notes alone form second species.",
          v.notes.filter((n) => n.pitch && !n.rest),
        );
      if (moving) {
        const broken = v.notes.filter(
          (n) =>
            n.time > 0 &&
            n.time < (s.bars - 1) * 8 &&
            n.time % 8 === 0 &&
            !n.tieStop &&
            !n.rest,
        );
        if (broken.length > 1)
          add(
            "broken-suspensions",
            "Several syncopations are broken here. Fux permits untied halves where needed; look for places to resume the chain rather than treating a numerical limit as a universal law.",
            broken,
            "suggestion",
          );
      }
    }
  }
  if (s.voices.length === 2 && !s.cantusOnly) {
    const [top, low] = s.voices;
    const cp = s.voices.find((v) => !v.locked)!;
    const first = cp.notes.find((n) => !n.rest);
    if (first?.pitch) {
      const other = at(
        s.voices.find((v) => v.locked)!,
        first.time,
      );
      if (other?.pitch && !other.rest) {
        const sem = interval(first, other).semitones;
        const allowed = top.locked ? sem === 0 : [0, 7].includes(sem);
        if (!allowed)
          add(
            "opening",
            "The first sounding counterpoint note must form the prescribed perfect opening consonance.",
            [first, other],
          );
      }
    }
    const times = [
      ...new Set(s.voices.flatMap((v) => v.notes.map((n) => n.time))),
    ].sort((a, b) => a - b);
    let prev: { a: Note; b: Note } | undefined;
    for (const t of times) {
      const a = at(top, t),
        b = at(low, t);
      if (!a?.pitch || !b?.pitch || a.rest || b.rest) {
        prev = undefined;
        continue;
      }
      if (
        s.species === 1 &&
        midi(a.pitch) === midi(b.pitch) &&
        t > 0 &&
        t < (s.bars - 1) * 8
      )
        add(
          "interior-unison",
          "Reserve the unison for the beginning or ending of two-voice counterpoint.",
          [a, b],
        );
      if (s.species === 1 && prev) {
        const da = midi(a.pitch) - midi(prev.a.pitch!),
          db = midi(b.pitch) - midi(prev.b.pitch!);
        if (
          da &&
          db &&
          Math.sign(da) === Math.sign(db) &&
          [0, 7].includes(interval(a, b).semitones) &&
          interval(prev.a, prev.b).semitones !== interval(a, b).semitones
        )
          add(
            "direct-perfect",
            "Fux requires contrary or oblique motion into this perfect consonance; similar motion is not permitted in two-voice first species, even when the upper part steps.",
            [prev.a, prev.b, a, b],
          );
      }
      prev = { a, b };
    }
    const final = cp.notes.at(-1),
      penult = cp.notes.at(-2);
    if (final?.pitch && penult?.pitch) {
      const cf = s.voices.find((v) => v.locked)!,
        other = at(cf, penult.time);
      if (other?.pitch) {
        const i = interval(penult, other);
        if (!(
          (i.diatonic === 6 && i.semitones === 9) ||
          (i.diatonic === 3 && i.semitones === 3)
        ))
          add(
            "cadential-interval",
            "Prepare the two-voice ending with a major sixth opening to an octave or a minor third closing to a unison.",
            [penult, other, final],
          );
      }
    }
  }
  for (const v of vs) {
    const species = assignedSpecies(s, v);
    for (let k = 0; k < v.notes.length; k++) {
      const n = v.notes[k];
      const chainRest =
        s.voices.length > 2 &&
        species === 4 &&
        [4, 8].includes(n.duration) &&
        n.time % 8 === 0;
      const openingRest = !v.notes.slice(0, k).some((p) => !p.rest);
      if (
        n.rest &&
        (species === 1 || (species < 5 && n.time > 0 && !openingRest)) &&
        !chainRest
      )
        add(
          "rest-placement",
          "Use rests only in the documented opening position for this species.",
          [n],
        );
      if (
        n.tieStart &&
        n.pitch &&
        !n.rest &&
        v.notes[k + 1]?.pitch &&
        !v.notes[k + 1]?.rest &&
        species < 4 &&
        !(s.voices.length > 2 && n.time + n.duration >= (s.bars - 2) * 8)
      )
        add(
          "species-tie",
          "Tied syncopations belong to fourth or fifth species.",
          [n],
        );
      if (n.time === (s.bars - 1) * 8 && (n.rest || n.duration !== 8))
        add("final-rhythm", "Close the exercise with a sounding whole note.", [
          n,
        ]);
    }
  }
  if (s.voices.length > 2) {
    const cfFinal = s.voices.find((v) => v.locked)?.notes.at(-1)?.pitch;
    const moments = [
      ...new Set(
        s.voices.flatMap((v) =>
          v.notes.filter((n) => n.time < 8).map((n) => n.time),
        ),
      ),
    ].sort((a, b) => a - b);
    const firstTime = moments.find((t) =>
      s.voices.every((v) => {
        const n = at(v, t);
        return n?.pitch && !n.rest;
      }),
    );
    if (cfFinal && firstTime !== undefined) {
      const first = s.voices.map((v) => at(v, firstTime)!) as Note[];
      const bass = first.reduce((a, b) =>
        midi(a.pitch!) < midi(b.pitch!) ? a : b,
      );
      if (midi(bass.pitch!) % 12 !== midi(cfFinal) % 12)
        add(
          "opening-bass",
          "Build the first complete chord on the modal final in the bass.",
          first,
        );
      for (const n of first) {
        const iv = interval(n, bass);
        if (!(
          (iv.diatonic === 1 && iv.semitones === 0) ||
          (iv.diatonic === 5 && iv.semitones === 7) ||
          (iv.diatonic === 3 && [3, 4].includes(iv.semitones))
        ))
          add(
            "opening-sonority",
            "Use the modal final, its third, fifth, and octaves in the first complete chord.",
            [bass, n],
          );
      }
    }
    const end = (s.bars - 1) * 8;
    const ns = s.voices.map((v) => at(v, end));
    if (ns.every((n) => n?.pitch && !n.rest)) {
      const sounding = ns as Note[];
      const bass = sounding.reduce((a, b) =>
        midi(a.pitch!) < midi(b.pitch!) ? a : b,
      );
      const cf = s.voices.find((v) => v.locked)?.notes.at(-1)?.pitch;
      if (cf && midi(bass.pitch!) % 12 !== midi(cf) % 12)
        add("final-bass", "End with the modal final in the bass.", sounding);
      for (const n of sounding) {
        const i = interval(n, bass);
        if (![0, 4, 7].includes(i.semitones))
          add(
            "final-sonority",
            "Use the modal final, perfect fifth, octave, or permitted major third in the final sonority.",
            [bass, n],
          );
      }
      const arrivals = s.voices.map((v) => {
        const n = at(v, end)!;
        const p = v.notes
          .filter((p) => p.time < end && !p.rest && !p.tieStop)
          .at(-1);
        return { p, n };
      });
      if (cfFinal && arrivals.every(({ p }) => p?.pitch)) {
        const closes = arrivals.some(
          ({ p, n }) =>
            midi(n.pitch!) % 12 === midi(cfFinal) % 12 &&
            (s.mode === "Phrygian"
              ? Math.abs(degree(n.pitch!) - degree(p!.pitch!)) === 1
              : midi(n.pitch!) - midi(p!.pitch!) === 1),
        );
        if (!closes)
          add(
            "multivoice-cadence",
            "Give one voice a stepwise arrival on the modal final: normally a rising semitone, with the Phrygian alternative kept natural.",
            arrivals.flatMap(({ p, n }) => [p!, n]),
          );
      }
    }
  }
  return explainFindings(s, [
    ...new Map(out.map((f) => [f.rule + f.notes.join(","), f])).values(),
  ]);
}
export function assess(s: Score) {
  const findings = check(s);
  const pending = s.voices.flatMap((v) =>
    v.notes.filter((n) => !n.pitch && !n.rest).map((n) => n.id),
  );
  return {
    ruleVersion: RULE_VERSION,
    status: pending.length
      ? "incomplete"
      : findings.some((f) => f.severity === "error")
        ? "violations"
        : findings.some((f) => f.basis === "review")
          ? "needs-review"
          : "pass",
    pending,
    findings,
  };
}
