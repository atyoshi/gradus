// Gradus engine: first-species counterpoint rules, cantus generator, solver.
// Pitch = { d: diatonic step (C0 = 0, C4 = 28), alt: -1 | 0 | 1 }.
const Gradus = (() => {
  const LETTERS = 'CDEFGAB';
  const LETTER_SEMI = [0, 2, 4, 5, 7, 9, 11];
  const MODES = {
    ionian:     { name: 'Ionian',     steps: [0, 2, 4, 5, 7, 9, 11] },
    dorian:     { name: 'Dorian',     steps: [0, 2, 3, 5, 7, 9, 10] },
    phrygian:   { name: 'Phrygian',   steps: [0, 1, 3, 5, 7, 8, 10] },
    lydian:     { name: 'Lydian',     steps: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
    aeolian:    { name: 'Aeolian',    steps: [0, 2, 3, 5, 7, 8, 10] },
  };

  const midi = n => 12 * (Math.floor(n.d / 7) + 1) + LETTER_SEMI[((n.d % 7) + 7) % 7] + n.alt;
  const letterOf = d => ((d % 7) + 7) % 7;
  const ACC = { '-1': '♭', '0': '', '1': '♯' };
  const noteName = n => LETTERS[letterOf(n.d)] + ACC[n.alt] + (Math.floor(n.d / 7));
  const pitchClassName = n => LETTERS[letterOf(n.d)] + ACC[n.alt];

  // Key signature: alteration per letter for a tonic + mode.
  function signature(key) {
    const sig = [0, 0, 0, 0, 0, 0, 0];
    const steps = MODES[key.mode].steps;
    for (let i = 0; i < 7; i++) {
      const letter = (key.tl + i) % 7;
      let target = (LETTER_SEMI[key.tl] + key.ta + steps[i]) % 12;
      let alt = target - LETTER_SEMI[letter];
      while (alt > 6) alt -= 12;
      while (alt < -6) alt += 12;
      sig[letter] = alt;
    }
    return sig;
  }
  function validKey(key) {
    const sig = signature(key);
    if (sig.some(a => Math.abs(a) > 1)) return false;
    const sharps = sig.filter(a => a > 0).length, flats = sig.filter(a => a < 0).length;
    return !(sharps && flats) && sharps + flats <= 3;
  }
  function keysFor(mode) {
    const out = [];
    for (let tl = 0; tl < 7; tl++) for (const ta of [-1, 0, 1]) {
      const k = { tl, ta, mode };
      if (validKey(k)) out.push(k);
    }
    return out;
  }
  const keyName = k => LETTERS[k.tl] + ACC[k.ta] + ' ' + MODES[k.mode].name;

  // Interval between lower a and upper b.
  function interval(a, b) {
    const dn = b.d - a.d, semis = midi(b) - midi(a);
    const oct = Math.floor(dn / 7), g = ((dn % 7) + 7) % 7;
    const s = semis - 12 * oct;
    let q = '?';
    if (g === 0 || g === 3 || g === 4) {
      const base = [0, 0, 0, 5, 7][g];
      q = s === base ? 'P' : s === base + 1 ? 'A' : s === base - 1 ? 'd' : '?';
    } else {
      const minor = { 1: 1, 2: 3, 5: 8, 6: 10 }[g];
      q = s === minor ? 'm' : s === minor + 1 ? 'M' : s === minor - 1 ? 'd' : s === minor + 2 ? 'A' : '?';
    }
    const consonant = (g === 0 && s === 0) || (g === 2 && (s === 3 || s === 4)) || (g === 4 && s === 7) || (g === 5 && (s === 8 || s === 9));
    const perfect = consonant && (g === 0 || g === 4);
    return { dn, semis, g, s, q, consonant, perfect, label: q + (dn + 1), figure: dn + 1 };
  }
  const INTERVAL_WORDS = { 0: 'unison', 1: '2nd', 2: '3rd', 3: '4th', 4: '5th', 5: '6th', 6: '7th' };
  const QUAL_WORDS = { P: 'perfect', M: 'major', m: 'minor', A: 'augmented', d: 'diminished', '?': '' };
  function describe(iv) {
    if (iv.dn === 7 && iv.s === 0) return 'an octave';
    if (iv.dn === 0 && iv.s === 0) return 'a unison';
    const size = iv.dn >= 7 ? (iv.dn === 9 ? '10th' : iv.dn === 11 ? '12th' : iv.dn === 8 ? '9th' : iv.dn === 10 ? '11th' : (iv.dn + 1) + 'th') : INTERVAL_WORDS[iv.g];
    if (iv.g === 3 && iv.q === 'A' || iv.g === 4 && iv.q === 'd') return 'a tritone (' + QUAL_WORDS[iv.q] + ' ' + size + ')';
    const w = QUAL_WORDS[iv.q];
    return (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w + ' ' + size;
  }

  // ---- Melodic intervals (signed, from note a to note b) ----
  function melodic(a, b) {
    const g = b.d - a.d, s = midi(b) - midi(a);
    const ag = Math.abs(g), as = Math.abs(s);
    const iv = g >= 0 ? interval(a, b) : interval(b, a);
    let ok = false;
    if (ag === 1) ok = as === 1 || as === 2;
    else if (ag === 2) ok = as === 3 || as === 4;
    else if (ag === 3) ok = as === 5;
    else if (ag === 4) ok = as === 7;
    else if (ag === 5) ok = g > 0 && as === 8;
    else if (ag === 7) ok = as === 12;
    return { g, s, ag, ok, step: ag === 1, leap: ag >= 2, bigLeap: ag >= 3, dir: Math.sign(g), iv };
  }

  // ---- Rule check ----
  // ex = { key, cf: [pitch], above: bool }, cp = [pitch|null]
  // Fux lets the counterpoint cross the cantus when that avoids a worse progression (p. 36-37), so the interval is
  // always read from the lower sounding note to the higher one, and a crossing is only a suggestion.
  const lowFirst = (a, b) => (b.d < a.d || (b.d === a.d && midi(b) < midi(a))) ? [b, a] : [a, b];
  const ivLH = (a, b) => interval(...lowFirst(a, b));
  function voices(ex, cp, i) {
    const [lo, hi] = lowFirst(ex.cf[i], cp[i]); return { lo, hi };
  }

  // Errors at position i (vertical i and transition i-1 -> i).
  function localErrors(ex, cp, i) {
    const out = [], n = ex.cf.length, sig = signature(ex.key);
    const c = cp[i];
    if (!c) return out;
    const { lo, hi } = voices(ex, cp, i);
    const v = interval(lo, hi);
    const cfN = noteName(ex.cf[i]), cpN = noteName(c);
    const crossed = ex.above ? midi(c) < midi(ex.cf[i]) : midi(c) > midi(ex.cf[i]);
    if (crossed) out.push({ sev: 'warn', rule: 'crossing', cols: [i], msg: `The voices cross: your ${cpN} is ${ex.above ? 'below' : 'above'} the cantus (${cfN}). Fux allows a brief crossing when it avoids a worse progression, but the line normally stays ${ex.above ? 'above' : 'below'} the cantus.` });
    if (!v.consonant) {
      out.push({ rule: 'dissonance', cols: [i], msg: `${cpN} against ${cfN} makes ${describe(v)}, a dissonance. In first species every interval must be a consonance: unison, 3rd, 5th, 6th or octave.` });
    }
    if (v.dn > 11) out.push({ rule: 'spacing', cols: [i], msg: `The voices are more than a 12th apart here. Keep them within a 10th where you can.` });
    if (i === 0 && v.consonant) {
      const okStart = ex.above ? v.perfect : (v.perfect && v.g === 0);
      if (!okStart) out.push({ rule: 'start', cols: [0], msg: ex.above
        ? `Begin with a perfect consonance (unison, 5th or octave) so the mode is clear from the first sound. You started on ${describe(v)}.`
        : `When the counterpoint is below, begin on a unison or octave. A 5th below would put the bass outside the mode. You started on ${describe(v)}.` });
    }
    if (i === n - 1 && v.consonant && !(v.perfect && v.g === 0)) {
      out.push({ rule: 'end', cols: [i], msg: `End on a unison or octave with the cantus. You ended on ${describe(v)}.` });
    }
    if (i > 0 && i < n - 1 && v.dn === 0 && v.semis === 0) {
      out.push({ rule: 'unison', cols: [i], msg: `Unisons belong only at the beginning and end. In the middle the two voices merge into one.` });
    }
    // Cadence: penultimate vertical must be M6 (above) or m3 (below).
    if (i === n - 2 && v.dn >= 0) {
      const want = ex.above ? { g: 5, s: 9, w: 'major 6th' } : { g: 2, s: 3, w: 'minor 3rd' };
      if (!(v.g === want.g && v.s === want.s)) {
        let msg = `The cadence needs ${ex.above ? 'a major 6th opening to the octave' : 'a minor 3rd closing to the unison or octave'}: your second-to-last note should step to the final by contrary motion.`;
        if (v.g === want.g) {
          const fix = { d: c.d, alt: c.alt + (want.s - v.s) * (ex.above ? 1 : -1) };
          msg = `Raise the leading tone: at the cadence ${cpN} should be ${noteName(fix)}, making ${want.w === 'major 6th' ? 'a major 6th' : 'a minor 3rd'} that resolves by half step to the final.`;
        }
        out.push({ rule: 'cadence', cols: [i], msg });
      }
    }
    // Chromatic notes: anything off the mode except the cadence leading tone.
    if (c.alt !== sig[letterOf(c.d)] && i !== n - 2) {
      out.push({ rule: 'chromatic', sev: 'warn', cols: [i], msg: `${cpN} is outside the mode. Use chromatic notes only for the raised leading tone at the cadence.` });
    }
    if (i > 0 && cp[i - 1]) {
      const p = cp[i - 1], pv = voices(ex, cp, i - 1), pvi = interval(pv.lo, pv.hi);
      const mc = midi(c) - midi(p), mf = midi(ex.cf[i]) - midi(ex.cf[i - 1]);
      const mel = melodic(p, c);
      if (!mel.ok && mel.ag !== 0) {
        out.push({ rule: 'melodic', cols: [i - 1, i], msg: `The leap ${noteName(p)} → ${cpN} is ${mel.ag === 5 && mel.dir < 0 ? 'a descending 6th' : describe(mel.iv)}, which is hard to sing. Allowed: steps, 3rds, perfect 4ths and 5ths, the ascending minor 6th, and the octave.` });
      }
      if (v.perfect && pvi.perfect && v.g === pvi.g && mc !== 0 && mf !== 0) {
        const kind = v.g === 4 ? 'fifths' : 'octaves';
        out.push({ rule: 'parallel', cols: [i - 1, i], msg: `Parallel ${kind}: ${describe(pvi)} moves to ${describe(v)} in the same direction. The voices lose their independence. Approach a perfect interval by contrary or oblique motion.` });
      } else if (v.perfect && v.dn > 0 && mc !== 0 && mf !== 0 && Math.sign(mc) === Math.sign(mf)) {
        out.push({ rule: 'direct', cols: [i - 1, i], msg: `Direct ${v.g === 4 ? 'fifth' : 'octave'}: both voices move the same way into ${describe(v)}. In two-voice counterpoint, reach perfect intervals by contrary motion.` });
      }
    }
    return out.map(e => ({ sev: 'error', ...e }));
  }

  // A line that rises or falls in one direction and spans a tritone outlines it, even if no single leap is one.
  function outlines(cp, word) {
    const out = [], idx = cp.map((c, i) => c ? i : -1).filter(i => i >= 0);
    let st = 0;
    const flush = (a, b) => {
      if (b - a < 2) return;
      const lo = cp[idx[a]], hi = cp[idx[b]], iv = midi(lo) < midi(hi) ? interval(lo, hi) : interval(hi, lo);
      if ((iv.g === 3 && iv.q === 'A') || (iv.g === 4 && iv.q === 'd')) out.push({ sev: 'warn', rule: 'outline', cols: idx.slice(a, b + 1), msg: `From ${noteName(lo)} to ${noteName(hi)} the line ${midi(hi) > midi(lo) ? 'climbs' : 'falls'} through a tritone. Turn back before the ${word} reaches it, or go on past it.` });
    };
    for (let k = 2; k <= idx.length; k++) {
      const dir = (a, b) => Math.sign(cp[idx[b]].d - cp[idx[a]].d);
      if (k === idx.length || idx[k] !== idx[k - 1] + 1 || dir(k - 1, k) !== dir(k - 2, k - 1) || dir(k - 1, k) === 0) { flush(st, k - 1); st = k - 1; }
    }
    return out;
  }
  function check(ex, cp) {
    const n = ex.cf.length, issues = [];
    const figures = [];
    for (let i = 0; i < n; i++) {
      issues.push(...localErrors(ex, cp, i));
      if (cp[i]) { const { lo, hi } = voices(ex, cp, i); figures.push(interval(lo, hi)); } else figures.push(null);
    }
    const filled = cp.filter(Boolean).length, complete = filled === n;
    // Melodic quality of the counterpoint (only over consecutive filled notes).
    const notes = cp.map((c, i) => c && { ...c, i }).filter(Boolean);
    const moves = [];
    for (let k = 1; k < notes.length; k++) if (notes[k].i === notes[k - 1].i + 1) moves.push({ a: notes[k - 1], b: notes[k], m: melodic(notes[k - 1], notes[k]) });
    // Fux (p. 29): the counterpoint may repeat a tone occasionally, but not more than once.
    let rep1 = 0;
    for (const mv of moves) if (mv.m.ag === 0 && ++rep1 > 1) issues.push({ sev: 'warn', rule: 'repeat', cols: [mv.a.i, mv.b.i], msg: `Repeated note (${noteName(mv.b)}). Fux allows one repeated note in an exercise, not more; the line stalls. Move by step instead.` });
    issues.push(...outlines(cp, 'line'));
    for (let k = 1; k < moves.length; k++) {
      const a = moves[k - 1], b = moves[k];
      if (b.a.i !== a.b.i) continue;
      if (a.m.bigLeap && !(b.m.step && b.m.dir === -a.m.dir)) issues.push({ sev: 'warn', rule: 'recovery', cols: [a.a.i, a.b.i, b.b.i], msg: `After the leap ${noteName(a.a)} → ${noteName(a.b)}, step back in the opposite direction to fill the gap.` });
      else if (a.m.leap && b.m.leap && a.m.dir === b.m.dir) issues.push({ sev: 'warn', rule: 'double-leap', cols: [a.a.i, a.b.i, b.b.i], msg: `Two leaps in the same direction (${noteName(a.a)} → ${noteName(a.b)} → ${noteName(b.b)}) make the line jumpy. Follow a leap with a step.` });
    }
    // Runs of parallel imperfect consonances.
    let run = 1;
    for (let i = 1; i <= n; i++) {
      const a = figures[i - 1], b = figures[i];
      if (a && b && a.consonant && !a.perfect && b.g === a.g && b.consonant) run++;
      else {
        if (run > 3) issues.push({ sev: 'warn', rule: 'parallel-run', cols: Array.from({ length: run }, (_, k) => i - run + k), msg: `${run} ${figures[i - 1].g === 2 ? '3rds' : '6ths'} in a row. The voices move as one block; break the run with contrary motion.` });
        run = 1;
      }
    }
    const strengths = [];
    if (notes.length >= 3) {
      const tops = notes.filter(x => midi(x) === Math.max(...notes.map(midi)));
      const bots = notes.filter(x => midi(x) === Math.min(...notes.map(midi)));
      const peak = ex.above ? tops : bots;
      if (complete) {
        if (peak.length > 1) issues.push({ sev: 'warn', rule: 'climax', cols: peak.map(x => x.i), msg: `Your ${ex.above ? 'highest' : 'lowest'} note (${noteName(peak[0])}) appears ${peak.length} times. A single climax gives the line a clear shape.` });
        else {
          const cfPeak = ex.cf.reduce((m, x, i) => (ex.above ? midi(x) > midi(ex.cf[m]) : midi(x) < midi(ex.cf[m])) ? i : m, 0);
          if (peak[0].i === cfPeak) issues.push({ sev: 'warn', rule: 'climax', cols: [peak[0].i], msg: `Your climax falls on the same note as the cantus's climax. Placing them apart keeps both lines audible.` });
          else strengths.push({ rule: 'climax', cols: [peak[0].i], msg: `One clear climax (${noteName(peak[0])}) gives the line a shape.` });
        }
      }
      const range = Math.max(...notes.map(x => x.d)) - Math.min(...notes.map(x => x.d));
      if (range > 9) issues.push({ sev: 'warn', rule: 'range', cols: [], msg: `The line spans more than a 10th. Keep it within a singer's comfortable range.` });
      if (complete && range < 3) issues.push({ sev: 'warn', rule: 'range', cols: [], msg: `The line stays within a 3rd. Give it more room to move.` });
    }
    if (complete && moves.length) {
      const steps = moves.filter(x => x.m.step).length / moves.length;
      if (steps < 0.5) issues.push({ sev: 'warn', rule: 'steps', cols: [], msg: `Only ${Math.round(steps * 100)}% of your moves are steps. A singable line moves mostly by step, with leaps for contrast.` });
      else if (steps >= 0.6) strengths.push({ rule: 'steps', cols: [], msg: `Mostly stepwise (${Math.round(steps * 100)}% steps): the line is easy to sing.` });
      let contrary = 0;
      for (let i = 1; i < n; i++) {
        const mc = midi(cp[i]) - midi(cp[i - 1]), mf = midi(ex.cf[i]) - midi(ex.cf[i - 1]);
        if (mc && mf && Math.sign(mc) !== Math.sign(mf)) contrary++;
      }
      const cr = contrary / (n - 1);
      if (cr >= 0.5) strengths.push({ rule: 'contrary', cols: [], msg: `Contrary motion in ${Math.round(cr * 100)}% of moves keeps the voices independent.` });
      else if (cr < 0.3) issues.push({ sev: 'warn', rule: 'contrary', cols: [], msg: `Only ${Math.round(cr * 100)}% of moves are in contrary motion. Let your line answer the cantus more often.` });
      const inner = figures.slice(1, -1), perf = inner.filter(f => f && f.perfect).length;
      if (inner.length && perf / inner.length > 0.4) issues.push({ sev: 'warn', rule: 'hollow', cols: [], msg: `${perf} of ${inner.length} inner intervals are perfect (5ths or octaves). Favor 3rds and 6ths in the middle for a fuller sound.` });
      else if (inner.length && perf / inner.length <= 0.25) strengths.push({ rule: 'imperfect', cols: [], msg: `The middle is built mainly from 3rds and 6ths, which sounds full and warm.` });
    }
    const errors = issues.filter(x => x.sev === 'error'), warns = issues.filter(x => x.sev === 'warn');
    const shape = complete ? Math.max(20, 100 - 10 * warns.length) : null;
    return { issues, errors, warns, strengths, figures, complete, filled, shape };
  }

  // ---- Random helpers ----
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Tonic placed so its MIDI pitch lies in [lo, hi].
  function tonicNote(key, lo, hi) {
    for (let o = 1; o < 7; o++) { const n = { d: key.tl + 7 * o, alt: key.ta }; const m = midi(n); if (m >= lo && m <= hi) return n; }
    return { d: key.tl + 28, alt: key.ta };
  }
  const inMode = (d, sig) => ({ d, alt: sig[letterOf(d)] });

  // Cantus firmus generator.
  function makeCantus(key, len, final, r) {
    const sig = signature(key);
    const lo = final.d - 3, hi = final.d + 8;
    let best = null;
    function ok(seq) {
      const n = seq.length, a = seq[n - 2], b = seq[n - 1];
      const m = melodic(a, b);
      if (!m.ok || m.ag === 0 || m.ag === 7) return false;
      if (n >= 3) {
        const p = melodic(seq[n - 3], a);
        if (p.bigLeap && !(m.step && m.dir === -p.dir)) return false;
        if (p.leap && m.leap) return false;
        // no outlined tritone over three notes
        const span = Math.abs(midi(b) - midi(seq[n - 3]));
        if (span === 6 && Math.abs(b.d - seq[n - 3].d) <= 4) return false;
      }
      const leaps = seq.slice(1).filter((x, k) => melodic(seq[k], x).leap).length;
      if (leaps > 4) return false;
      return true;
    }
    function dfs(seq) {
      if (best) return;
      const n = seq.length;
      if (n === len - 2) {
        const pen = inMode(final.d + 1, sig), fin = final;
        const s2 = [...seq, pen];
        if (!ok(s2)) return;
        const s3 = [...s2, fin];
        if (!ok(s3)) return;
        const ds = s3.map(x => midi(x)), top = Math.max(...ds);
        if (ds.filter(x => x === top).length !== 1) return;
        if (top - midi(final) < 4) return;
        const leaps = s3.slice(1).filter((x, k) => melodic(s3[k], x).leap).length;
        if (leaps < 2) return;
        best = s3; return;
      }
      const cands = shuffle([-4, -3, -2, -1, 1, 1, 2, 2, 3, 4].map(k => seq[n - 1].d + k), r);
      for (const d of cands) {
        if (d < lo || d > hi || d < final.d - 2) continue;
        const s2 = [...seq, inMode(d, sig)];
        if (ok(s2)) dfs(s2);
        if (best) return;
      }
    }
    dfs([final]);
    return best;
  }

  // Solver: search counterpoints with no errors; return the best by shape score.
  function solve(ex, r, limitMs = 120) {
    const n = ex.cf.length, sig = signature(ex.key), t0 = Date.now();
    const cands = i => {
      const out = [], base = ex.cf[i].d;
      for (let k = 0; k <= 11; k++) {
        const d = ex.above ? base + k : base - k;
        const notes = [inMode(d, sig)];
        if (i === n - 2) notes.push({ d, alt: sig[letterOf(d)] + (ex.above ? 1 : 1) });
        for (const c of notes) {
          const lo = ex.above ? ex.cf[i] : c, hi = ex.above ? c : ex.cf[i];
          if (interval(lo, hi).consonant && Math.abs(c.alt) <= 1) out.push(c);
        }
      }
      return shuffle(out, r);
    };
    const pools = ex.cf.map((_, i) => cands(i));
    const sols = [], cp = new Array(n).fill(null);
    let leaps = 0;
    (function dfs(i) {
      if (sols.length >= 60 || Date.now() - t0 > limitMs) return;
      if (i === n) { const res = check(ex, cp); if (!res.errors.length) sols.push({ cp: cp.slice(), score: res.shape - res.warns.length }); return; }
      for (const c of pools[i]) {
        cp[i] = c;
        if (!localErrors(ex, cp, i).some(e => e.sev === 'error')) {
          if (i > 0) { const m = melodic(cp[i - 1], c); if (m.ag === 0 || (i > 1 && m.bigLeap && melodic(cp[i - 2], cp[i - 1]).bigLeap)) { cp[i] = null; continue; } }
          dfs(i + 1);
        }
        cp[i] = null;
        if (sols.length >= 60 || Date.now() - t0 > limitMs) return;
      }
    })(0);
    sols.sort((a, b) => b.score - a.score);
    return sols.length ? sols[0].cp : null;
  }

  // A varied rhythm plan for fifth species, with a few suspensions where the bars allow a tie.
  function florid(len, r) {
    const ids = RHYTHMS.map(x => x.id), rh = [null], ties = new Array(len - 1).fill(false);
    for (let b = 1; b < len - 1; b++) {
      let id;
      do { id = ids[Math.floor(r() * ids.length)]; } while (b >= 3 && id === rh[b - 1] && id === rh[b - 2]);
      rh.push(id);
    }
    rh[len - 2] = r() < 0.5 ? 'hh' : 'hqq';
    // Forcing the cadence bar must not create three equal bars in a row.
    if (len >= 5 && rh[len - 3] === rh[len - 2] && rh[len - 4] === rh[len - 2]) { const alt = ids.filter(id => id !== rh[len - 2]); rh[len - 3] = alt[Math.floor(r() * alt.length)]; }
    rh.push(null);
    const startsHalf = id => rhythmOf(id).durs[0] === 2, endsHalf = id => { const d = rhythmOf(id).durs; return d[d.length - 1] === 2; };
    for (let b = 0; b < len - 2; b++) {
      const lastHalf = b === 0 ? true : endsHalf(rh[b]);
      if (lastHalf && startsHalf(rh[b + 1]) && r() < (b === len - 3 ? 0.9 : 0.4)) ties[b] = true;
    }
    return { species: 5, rh, ties };
  }
  // Fux's own cantus firmi from Gradus ad Parnassum (1725), one per mode, at his pitch. fuxCantus moves the line by
  // octaves so its final lands where a generated cantus would.
  const FUX = {
    dorian: 'D4 F4 E4 D4 G4 F4 A4 G4 F4 E4 D4',
    phrygian: 'E4 C4 D4 C4 A3 A4 G4 E4 F4 E4',
    lydian: 'F4 G4 A4 F4 D4 E4 F4 C5 A4 F4 G4 F4',
    mixolydian: 'G4 C5 B4 G4 C5 E5 D5 G5 E5 C5 D5 B4 A4 G4',
    aeolian: 'A4 C5 B4 D5 C5 E5 F5 E5 D5 C5 B4 A4',
    ionian: 'C4 E4 F4 G4 E4 A4 G4 E4 F4 E4 D4 C4',
  };
  function fuxCantus(mode, lo, hi) {
    const notes = FUX[mode].split(' ').map(t => ({ d: LETTERS.indexOf(t[0]) + 7 * +t[1], alt: 0 }));
    const key = { tl: notes[0].d % 7, ta: 0, mode }, final = tonicNote(key, lo, hi), shift = final.d - notes[0].d;
    return { key, cf: notes.map(n => ({ d: n.d + shift, alt: 0 })), final };
  }
  function newExercise({ mode, above, seed, len: fixedLen, species = 1, fux = false }) {
    const r = rng(seed || Date.now());
    const modes = mode && mode !== 'any' ? [mode] : Object.keys(MODES), tries = {};
    for (let attempt = 0; attempt < 40 && modes.length; attempt++) {
      const m = modes[Math.floor(r() * modes.length)];
      // Fux's lines are fixed, so a mode whose line has no answer in this setting is dropped after a few tries.
      if (fux && (tries[m] = (tries[m] || 0) + 1) > 3) { modes.splice(modes.indexOf(m), 1); continue; }
      let key, cf;
      if (fux) ({ key, cf } = above ? fuxCantus(m, 46, 57) : fuxCantus(m, 56, 67));
      else {
        const keys = keysFor(m);
        key = keys[Math.floor(r() * keys.length)];
        const final = above ? tonicNote(key, 46, 57) : tonicNote(key, 56, 67);
        cf = makeCantus(key, fixedLen || 8 + Math.floor(r() * 4), final, r);
      }
      if (!cf) continue;
      const len = cf.length;
      const ex = { key, cf, above, id: Math.floor(r() * 1e9).toString(36) };
      if (fux) ex.fux = m;
      if (species === 5) {
        Object.assign(ex, florid(len, r));
        if (solveN(ex, r, 900)) return ex;
        continue;
      }
      if (species >= 2) {
        ex.species = species; if (solveN(ex, r, species === 3 ? 900 : 500)) return ex;
        // Two halves cannot always reach the cadence (above an Aeolian cantus, say): hold the penultimate bar instead.
        if (species === 2) { ex.pw = true; if (solveN(ex, r, 500)) return ex; delete ex.pw; }
        // Fux's own lines sometimes need the fourth species broken for one bar, as Fux himself does.
        if (species === 4 && fux) for (let i = 0; i < len - 2; i++) { ex.breaks = new Array(len - 1).fill(false); ex.breaks[i] = true; if (solveN(ex, r, 300)) return ex; }
        delete ex.breaks;
      }
      else if (solve(ex, r, 150)) return ex;
    }
    return null;
  }


  // ---------------- Writing a cantus firmus ----------------
  // One voice alone: start and end on the final, approach it by step, move mostly by step with leaps recovered,
  // one climax, a singable range, nothing chromatic and no repeated notes.
  function checkCantus(ex, cp) {
    const n = cp.length, sig = signature(ex.key), F = ex.final, issues = [], strengths = [];
    const push = (rule, cols, msg, sev = 'error') => issues.push({ sev, rule, cols, msg });
    const same = (a, b) => a && b && a.d === b.d && a.alt === b.alt;
    const fn = noteName(F).replace(/\d+$/, '');
    // The final may be taken in any octave (within one octave of the one on the page), as long as the line ends on the note it began on.
    const inClass = c => c && c.alt === F.alt && (c.d - F.d) % 7 === 0;
    const base = inClass(cp[0]) ? cp[0] : F;
    if (inClass(cp[0]) && Math.abs(cp[0].d - F.d) > 7) push('range', [0], `${noteName(cp[0])} is more than an octave from the exercise's ${noteName(F)}. It still counts as the final, but the line will sit far from a comfortable singing range.`, 'warn');
    if (cp[0] && !inClass(cp[0])) push('cf-final', [0], `A cantus begins on the final of its mode: ${fn}, in the octave of ${noteName(F)} or one octave away.`);
    if (cp[n - 1] && !same(cp[n - 1], base)) push('cf-final', [n - 1], `A cantus ends on its final, ${noteName(base)}, the note it began on.`);
    if (cp[n - 2] && cp[n - 1] && same(cp[n - 1], base)) { const m = melodic(cp[n - 2], cp[n - 1]); if (!m.step) push('cf-cadence', [n - 2, n - 1], `Approach the final by step: from the note above (the usual way) or from the leading tone below.`); }
    for (let i = 0; i < n; i++) {
      const c = cp[i]; if (!c) continue;
      if (c.alt !== sig[letterOf(c.d)]) push('chromatic', [i], `${noteName(c)} is outside the mode. A cantus firmus stays on the notes of its mode.`);
      if (Math.abs(c.d - base.d) > 9 || c.d < base.d - 4) push('range', [i], `${noteName(c)} is too far from the final. Keep the cantus within about a 4th below and an octave above ${fn}.`, 'warn');
      const p = i > 0 ? cp[i - 1] : null;
      if (p) {
        const m = melodic(p, c);
        if (m.ag === 0) push('repeat', [i - 1, i], `Repeated note (${noteName(c)}). A cantus keeps moving.`);
        else if (!m.ok) push('melodic', [i - 1, i], `The leap ${noteName(p)} → ${noteName(c)} is ${m.ag === 5 && m.dir < 0 ? 'a descending 6th' : describe(m.iv)}, which is hard to sing.`);
        else if (m.ag === 7) push('melodic', [i - 1, i], `An octave leap is rare in a cantus firmus. Keep the leaps to a 5th or a 6th.`, 'warn');
      }
    }
    const notes = cp.map((c, i) => c && { ...c, i }).filter(Boolean), moves = [];
    for (let k = 1; k < notes.length; k++) if (notes[k].i === notes[k - 1].i + 1) moves.push({ a: notes[k - 1], b: notes[k], m: melodic(notes[k - 1], notes[k]) });
    for (let k = 1; k < moves.length; k++) {
      const a = moves[k - 1], b = moves[k];
      if (b.a.i !== a.b.i) continue;
      if (a.m.bigLeap && !(b.m.step && b.m.dir === -a.m.dir)) push('recovery', [a.a.i, a.b.i, b.b.i], `After the leap ${noteName(a.a)} → ${noteName(a.b)}, step back in the opposite direction.`, 'warn');
      else if (a.m.leap && b.m.leap) push('double-leap', [a.a.i, a.b.i, b.b.i], `Two leaps in a row (${noteName(a.a)} → ${noteName(a.b)} → ${noteName(b.b)}). In a cantus, a leap is followed by a step.`, 'warn');
    }
    issues.push(...outlines(cp, 'cantus'));
    const filled = notes.length, complete = filled === n;
    if (complete) {
      const top = Math.max(...notes.map(midi)), peak = notes.filter(x => midi(x) === top);
      if (peak.length > 1) push('climax', peak.map(x => x.i), `The highest note (${noteName(peak[0])}) appears ${peak.length} times. A cantus has one climax.`, 'warn');
      else if (peak[0].i >= n - 2 || peak[0].i === 0) push('climax', [peak[0].i], `The climax sits at the ${peak[0].i === 0 ? 'start' : 'end'}. Place it somewhere in the middle, so the line rises and falls.`, 'warn');
      else strengths.push({ rule: 'climax', cols: [peak[0].i], msg: `One clear climax (${noteName(peak[0])}) in the middle of the line.` });
      const range = Math.max(...notes.map(x => x.d)) - Math.min(...notes.map(x => x.d));
      if (range > 9) push('range', [], `The cantus spans more than a 10th.`, 'warn');
      else if (range < 3) push('range', [], `The cantus stays within a 4th. Give it more room: a 5th to an octave.`, 'warn');
      const leaps = moves.filter(x => x.m.leap).length, steps = moves.filter(x => x.m.step).length;
      if (!leaps) push('steps', [], `No leaps at all. One to three leaps give a cantus its character.`, 'warn');
      else if (leaps > Math.max(4, Math.round(moves.length / 3))) push('steps', [], `${leaps} leaps in ${moves.length} moves. A cantus moves mostly by step.`, 'warn');
      else strengths.push({ rule: 'steps', cols: [], msg: `Mostly stepwise (${steps} of ${moves.length} moves), with ${leaps} ${leaps === 1 ? 'leap' : 'leaps'} for contrast.` });
    }
    const errors = issues.filter(x => x.sev === 'error'), warns = issues.filter(x => x.sev === 'warn');
    return { issues, errors, warns, strengths, figures: cp.map(() => null), complete, filled, shape: complete ? Math.max(20, 100 - 10 * warns.length) : null };
  }
  function allowedCantus(ex, cp, i) {
    const sig = signature(ex.key), F = ex.final, out = [], n = cp.length;
    // The first note is the final in the octave of the page or the next one down or up; the last note repeats the first.
    const octs = [{ d: F.d, alt: F.alt }, { d: F.d - 7, alt: F.alt }, { d: F.d + 7, alt: F.alt }];
    const first = cp[0] && octs.find(o => o.d === cp[0].d && o.alt === cp[0].alt);
    if (i === 0) return octs;
    if (i === n - 1) return first ? [first] : [F];
    const bs = first || F;
    for (let d = bs.d - 4; d <= bs.d + 9; d++) {
      const c = { d, alt: sig[letterOf(d)] }, t = cp.slice(); t[i] = c;
      if (!checkCantus(ex, t).errors.some(e => e.cols.includes(i))) out.push(c);
    }
    // Keep only notes that leave the line finishable: the last two notes must still be able to reach the final.
    const candsC = j => { if (j === n - 1) return [bs]; const r = []; for (let d = bs.d - 4; d <= bs.d + 9; d++) r.push({ d, alt: sig[letterOf(d)] }); return r; };
    const near = (t, j) => nearFirst(t, j, candsC(j));
    const keep = out.filter(c => { const t = cp.slice(); t[i] = c; return canContinue(t, i, tt => checkCantus(ex, tt).issues, near, 40, 3, [n - 2, n - 1]); });
    return keep.length ? keep : out;
  }
  const solveCantus = (ex, r) => makeCantus(ex.key, ex.cf.length, ex.final, r);
  function newCantusExercise({ mode, above, seed, len: fixedLen }) {
    const r = rng(seed || Date.now()), modes = mode && mode !== 'any' ? [mode] : Object.keys(MODES);
    const m = modes[Math.floor(r() * modes.length)], keys = keysFor(m), key = keys[Math.floor(r() * keys.length)];
    const len = fixedLen || 8 + Math.floor(r() * 4), final = above ? tonicNote(key, 62, 72) : tonicNote(key, 48, 58);
    return { kind: 'cantus', key, cf: new Array(len).fill(null), above, final, id: 'cf' + Math.floor(r() * 1e9).toString(36) };
  }

  // ---------------- Second and third species: several notes against each cantus note ----------------
  // The counterpoint is a flat list of slots. Bar 0 opens with a rest on the first beat, middle bars are
  // full (2 halves or 4 quarters), and the last bar is a whole note.
  const PER = { 2: 2, 3: 4, 4: 2 };
  // Fifth-species bar rhythms, as durations in quarter notes (a bar is 4).
  const RHYTHMS = [
    { id: 'hh', durs: [2, 2] }, { id: 'qqqq', durs: [1, 1, 1, 1] }, { id: 'qqh', durs: [1, 1, 2] },
    { id: 'hqq', durs: [2, 1, 1] }, { id: 'hq88', durs: [2, 1, 0.5, 0.5] }, { id: 'q88h', durs: [1, 0.5, 0.5, 2] },
  ];
  // Any bar made of halves (h), quarters (q) and eighths (8) that fills four beats is a valid rhythm id.
  // H = dotted half, Q = dotted quarter. Dotted notes start on a beat.
  const DUR_OF = { w: 4, H: 3, h: 2, Q: 1.5, q: 1, 8: 0.5 }, CH_OF = { 4: 'w', 3: 'H', 2: 'h', 1.5: 'Q', 1: 'q', 0.5: '8' };
  const idOf = durs => durs.map(d => CH_OF[d]).join('');
  function parseRhythm(id) {
    if (typeof id !== 'string' || !/^[HhQq8]+$/.test(id)) return null;
    const durs = [...id].map(c => DUR_OF[c]);
    let on = 0;
    for (const d of durs) { if ((d === 3 || d === 1.5) && on % 1) return null; on += d; }
    return on === 4 ? { id, durs } : null;
  }
  const rhythmOf = id => RHYTHMS.find(r => r.id === id) || parseRhythm(id) || RHYTHMS[0];
  // Every possible bar, for compact codes: the six classic rhythms first (so older links keep working), then the rest.
  const ALL_RHYTHMS = (() => {
    const out = RHYTHMS.map(r => r.id), walk = (left, acc) => { if (!left) { const id = idOf(acc); if (!out.includes(id)) out.push(id); return; } for (const d of [2, 1, 0.5]) if (d <= left) walk(left - d, acc.concat(d)); };
    walk(4, []);
    // Dotted rhythms come after every plain one, so codes for plain bars never change.
    const walkD = (left, acc) => { if (!left) { const id = idOf(acc); if (!out.includes(id) && parseRhythm(id)) out.push(id); return; } for (const d of [3, 2, 1.5, 1, 0.5]) if (d <= left) walkD(left - d, acc.concat(d)); };
    walkD(4, []); return out;
  })();
  // Every slot carries its onset (on) and length (dur) in quarters, plus n/beat for the regular species.
  function slotsN(ex) {
    const N = PER[ex.species] || 1, n = ex.cf.length, out = [];
    const mk = (bar, on, dur, extra) => Object.assign({ bar, on, dur, n: dur === 4 ? 1 : 4 / dur, beat: Math.round(on / dur), strong: on === 0 }, extra || {});
    if (ex.species === 5) {
      // Bar 0: half rest, then a half note. Middle bars follow ex.rh; a tie from the bar before takes the first half.
      const ties = ex.ties || [];
      out.push(mk(0, 2, 2, { tie: !!ties[0] }));
      for (let b = 1; b < n - 1; b++) {
        const durs = rhythmOf((ex.rh || [])[b]).durs;
        let on = 0;
        durs.forEach((d, j) => {
          if (!(j === 0 && ties[b - 1])) out.push(mk(b, on, d, { tie: j === durs.length - 1 && !!ties[b] }));
          on += d;
        });
      }
      out.push(mk(n - 1, 0, 4, { whole: true }));
      return out;
    }
    if (ex.species === 4) {
      // Fourth species: one fresh note on the second half of each bar, tied over into the next downbeat.
      // A broken tie (ex.breaks[b]) gives bar b+1 a fresh downbeat note instead, as in second species.
      const br = ex.breaks || [];
      for (let b = 0; b < n - 1; b++) {
        if (b > 0 && br[b - 1]) out.push(mk(b, 0, 2, { strong: true, broken: true }));
        out.push(mk(b, 2, 2, { strong: false, tie: b <= n - 3 && !br[b] }));
      }
      out.push(mk(n - 1, 0, 4, { whole: true }));
      return out;
    }
    for (let beat = 1; beat < N; beat++) out.push(mk(0, beat * 4 / N, 4 / N));
    // Second species may hold the penultimate bar as one whole note (ex.pw), when two halves cannot reach the cadence.
    for (let b = 1; b < n - 1; b++) {
      if (ex.pw && ex.species === 2 && b === n - 2) { out.push(mk(b, 0, 4)); continue; }
      for (let beat = 0; beat < N; beat++) out.push(mk(b, beat * 4 / N, 4 / N));
    }
    out.push(mk(n - 1, 0, 4, { whole: true }));
    return out;
  }
  function vertN(ex, sl, c) { return ivLH(ex.cf[sl.bar], c); }
  const BEAT_WORDS = ['first', 'second', 'third', 'fourth'];



  // Fifth (florid) species: the rhythms of the other species mixed bar by bar.
  function errors5(ex, cp) {
    const S = slotsN(ex), L = S.length, sig = signature(ex.key), out = [];
    const push = (rule, cols, msg, sev = 'error') => out.push({ sev, rule, cols, msg });
    const where = sl => sl.whole ? 'the last bar' : `bar ${sl.bar + 1}, beat ${sl.on + 1}`;
    for (let k = 0; k < L; k++) {
      const c = cp[k]; if (!c) continue;
      const sl = S[k], v = vertN(ex, sl, c), cfN = noteName(ex.cf[sl.bar]), cN = noteName(c);
      const p = k > 0 ? cp[k - 1] : null, q = k + 1 < L ? cp[k + 1] : null, r = k + 2 < L ? cp[k + 2] : null;
      const mp = p && melodic(p, c), mq = q && melodic(c, q);
      if (ex.above ? midi(c) < midi(ex.cf[sl.bar]) : midi(c) > midi(ex.cf[sl.bar])) push('crossing', [k], `The voices cross at ${where(sl)}: your ${cN} is ${ex.above ? 'below' : 'above'} the cantus (${cfN}). Fux allows a brief crossing to avoid a worse progression.`, 'warn');
      if (v.dn > 11) push('spacing', [k], `The voices are more than a 12th apart at ${where(sl)}.`);
      if (k === 0) {
        if (!(v.consonant && (ex.above ? v.perfect : v.perfect && v.g === 0))) push('start', [0], ex.above ? `After the half rest, begin on a perfect consonance (unison, 5th or octave). You wrote ${describe(v)}.` : `Below the cantus, begin on a unison or octave. You wrote ${describe(v)}.`);
      } else if (k === L - 1) {
        if (!(v.consonant && v.perfect && v.g === 0)) push('end', [k], `End on a unison or octave with the cantus. You ended on ${describe(v)}.`);
      } else if (sl.on === 0) {
        if (!v.consonant) push('dissonance', [k], `${cN} against ${cfN} makes ${describe(v)} on the downbeat. A downbeat you attack must be consonant; only a tied note may be dissonant there.`);
        else if (v.dn === 0 && v.s === 0) push('unison', [k], `A unison on a downbeat merges the voices.`);
      } else if (!v.consonant) {
        let ok;
        if (mp && !mp.step) ok = false;
        else if (!q) ok = true; // waits for the next note
        else if (sl.dur === 0.5) ok = mq.step;
        else if (sl.dur === 1) {
          const passing = mq.step && (!mp || mq.dir === mp.dir);
          const neighbour = mq.step && mp && mq.dir !== mp.dir && (sl.on === 1 || sl.on === 3);
          const cambiata = sl.on === 1 && mp && mp.dir < 0 && mq.ag === 2 && mq.dir < 0 && (!r || (melodic(q, r).step && melodic(q, r).dir > 0));
          ok = passing || neighbour || cambiata;
        } else ok = mq.step && (!mp || mq.dir === mp.dir);
        // After a suspension, the resolving note is checked below; a dissonant weak note right after a tie is wrong.
        if (!ok) push('passing', [k - 1, k, k + 1].filter(i => cp[i]), `${cN} against ${cfN} is ${describe(v)} at ${where(sl)}. A dissonance on a weak beat must be a passing tone, a neighbour (quarters on beats 2 or 4, or eighths), or a cambiata.`);
      }
      if (sl.dur === 0.5 && ((mp && !mp.step) || (mq && !mq.step))) push('eighths', [k - 1, k, k + 1].filter(i => cp[i]), `Eighth notes move by step, in and out. ${mp && !mp.step ? `${noteName(p)} → ${cN}` : `${cN} → ${noteName(q)}`} is a leap.`);
      if (k === L - 2 && v.dn >= 0) {
        const want = ex.above ? { g: 5, s: 9 } : { g: 2, s: 3 };
        if (!(v.g === want.g && v.s === want.s)) {
          let msg = `The cadence: the last note before the final should make ${ex.above ? 'a major 6th above' : 'a minor 3rd below'} the cantus and step to the final.`;
          if (v.g === want.g) msg = `Raise the leading tone: at the cadence ${cN} should be ${noteName({ d: c.d, alt: c.alt + (want.s - v.s) * (ex.above ? 1 : -1) })}.`;
          push('cadence', [k], msg);
        }
      }
      if (c.alt !== sig[letterOf(c.d)] && k !== L - 2) push('chromatic', [k], `${cN} is outside the mode. Use chromatic notes only for the raised leading tone at the cadence.`, 'warn');
      if (sl.tie) {
        const tv = tiedVert(ex, sl.bar + 1, c);
        if (ex.above ? midi(c) < midi(ex.cf[sl.bar + 1]) : midi(c) > midi(ex.cf[sl.bar + 1])) push('crossing', [k], `Tied into bar ${sl.bar + 2}, your ${cN} crosses the cantus.`, 'warn');
        else if (!tv.consonant) {
          const okType = ex.above ? (tv.g === 6 || tv.g === 3 || tv.g === 1) : tv.g === 1;
          if (!okType) push('suspension', [k], ex.above ? `Tied into bar ${sl.bar + 2}, ${cN} makes ${describe(tv)}. Above the cantus use the 7–6 or 4–3 suspension.` : `Tied into bar ${sl.bar + 2}, ${cN} makes ${describe(tv)}. Below the cantus use 2–3.`);
          // The resolution may be decorated: consonant quarters or eighths after the tie, as long as the step down
          // arrives by beat 4 of the same bar (for example, a 3rd down and back up).
          if (q && !(mq.step && mq.dir < 0)) {
            let j = k + 1, ok = false;
            for (; j < L && S[j].bar === sl.bar + 1 && S[j].on <= 3 && cp[j]; j++) {
              if (cp[j].d === c.d - 1) { ok = j > k + 1; break; }
              if (S[j].dur > 1 || !vertN(ex, S[j], cp[j]).consonant && S[j].dur !== 0.5) break;
            }
            const waiting = j < L && S[j].bar === sl.bar + 1 && S[j].on <= 3 && !cp[j];
            if (!ok && !waiting) push('suspension', [k, ...Array.from({ length: Math.max(1, Math.min(j, L - 1) - k) }, (_, q) => k + 1 + q)].filter(x => x < L && cp[x]), `The suspended ${cN} must resolve down by step, to ${noteName({ d: c.d - 1, alt: sig[letterOf(c.d - 1)] })}. You may decorate it first with short consonant notes, but the step down must come by beat 4.`);
          }
        }
      }
      if (p) {
        if (mp.ag === 0) push('repeat', [k - 1, k], `Repeated note (${cN}). Use a tie to hold a note; otherwise keep the line moving.`);
        else if (!mp.ok) push('melodic', [k - 1, k], `The leap ${noteName(p)} → ${cN} is ${mp.ag === 5 && mp.dir < 0 ? 'a descending 6th' : describe(mp.iv)}, which is hard to sing.`);
        if (sl.on === 0 && !sl.whole || k === L - 1) {
          const pv = vertN(ex, S[k - 1], p), mc = midi(c) - midi(p), mf = midi(ex.cf[sl.bar]) - midi(ex.cf[S[k - 1].bar]);
          if (S[k - 1].bar !== sl.bar && !S[k - 1].tie) {
            if (v.perfect && pv.perfect && v.g === pv.g && mc && mf) push('parallel', [k - 1, k], `Parallel ${v.g === 4 ? 'fifths' : 'octaves'} across the barline: ${describe(pv)} moves to ${describe(v)}.`);
            else if (v.perfect && v.dn > 0 && mc && mf && Math.sign(mc) === Math.sign(mf)) push('direct', [k - 1, k], `Direct ${v.g === 4 ? 'fifth' : 'octave'}: both voices move the same way into ${describe(v)} on the downbeat.`);
          }
        }
      }
    }
    // Eighths: Fux uses them in pairs, on the second or fourth quarter of the bar.
    for (let k = 0; k < L; k++) {
      const sl = S[k]; if (sl.dur !== 0.5 || !cp[k]) continue;
      const prevE = k > 0 && S[k - 1].dur === 0.5 && S[k - 1].bar === sl.bar, nextE = k + 1 < L && S[k + 1].dur === 0.5 && S[k + 1].bar === sl.bar;
      if (!prevE && (sl.on === 0 || sl.on === 2)) push('eighths', [k], `Eighth notes on beat ${sl.on + 1} sound rushed. Put a pair of eighths on the 2nd or 4th quarter of the bar.`, 'warn');
      else if (prevE && k > 1 && S[k - 2].dur === 0.5 && S[k - 2].bar === sl.bar && !(k > 2 && S[k - 3].dur === 0.5 && S[k - 3].bar === sl.bar)) push('eighths', [k - 2, k - 1, k], `More than two eighths in a row turns the line into running passage work. Keep eighths to a pair.`, 'warn');
      else if (!prevE && !nextE && !(k > 0 && S[k - 1].dur === 1.5 && S[k - 1].bar === sl.bar)) push('eighths', [k], `A single eighth note leaves the beat lopsided. Eighths come in pairs, or follow a dotted quarter.`, 'warn');
    }
    // Fux (p. 66): two quarters at the start of a bar, then a half note that is not tied on, make the line lag.
    for (let b = 1; b < ex.cf.length - 1; b++) if ((ex.rh || [])[b] === 'qqh' && !(ex.ties || [])[b]) push('rhythm', S.map((s, k) => s.bar === b ? k : -1).filter(k => k >= 0 && cp[k]), `Bar ${b + 1} opens with two quarters and then a plain half note. Fux (p. 66) finds that this lags: tie the half note over the barline, or add more quarters.`, 'warn');
    // Rhythm: florid counterpoint should vary.
    const rh = (ex.rh || []).slice(1, ex.cf.length - 1);
    for (let i = 2; i < rh.length; i++) if (rh[i] === rh[i - 1] && rh[i] === rh[i - 2]) { const bars = [i - 1, i, i + 1]; push('rhythm', S.map((s, k) => bars.includes(s.bar) ? k : -1).filter(k => k >= 0 && cp[k]), `Bars ${i - 1}–${i + 1} use the same rhythm three times. Florid counterpoint mixes the rhythms of the other species.`, 'warn'); }
    return out;
  }
  // Fourth species. cp holds the attacks; the note attacked in bar b sounds on through the downbeat of bar b+1.
  const tiedVert = (ex, b, c) => ivLH(ex.cf[b], c);
  function errors4(ex, cp) {
    const S = slotsN(ex), L = S.length, n = ex.cf.length, sig = signature(ex.key), out = [];
    const push = (rule, cols, msg, sev = 'error') => out.push({ sev, rule, cols, msg });
    for (let k = 0; k < L; k++) {
      const c = cp[k]; if (!c) continue;
      const sl = S[k], b = sl.bar, v = vertN(ex, sl, c), cfN = noteName(ex.cf[b]), cN = noteName(c);
      if (ex.above ? midi(c) < midi(ex.cf[b]) : midi(c) > midi(ex.cf[b])) push('crossing', [k], `The voices cross in bar ${b + 1}: your ${cN} is ${ex.above ? 'below' : 'above'} the cantus (${cfN}). Fux allows a brief crossing to avoid a worse progression.`, 'warn');
      if (v.dn > 11) push('spacing', [k], `The voices are more than a 12th apart in bar ${b + 1}.`);
      if (k === 0) {
        if (!(v.consonant && (ex.above ? v.perfect : v.perfect && v.g === 0))) push('start', [0], ex.above ? `After the half rest, begin on a perfect consonance (unison, 5th or octave). You wrote ${describe(v)}.` : `Below the cantus, begin on a unison or octave. You wrote ${describe(v)}.`);
      } else if (k === L - 1) {
        if (!(v.consonant && v.perfect && v.g === 0)) push('end', [k], `End on a unison or octave with the cantus. You ended on ${describe(v)}.`);
      } else if (!v.consonant) {
        push('dissonance', [k], sl.broken ? `${cN} against ${cfN} makes ${describe(v)} on the downbeat. Where the tie is broken, the downbeat note is struck, so it must be consonant.` : `${cN} against ${cfN} makes ${describe(v)}. The note you attack on the second half must be consonant: it resolves the suspension and prepares the next one.`);
      } else if (v.dn === 0 && v.s === 0 && !(k > 0 && S[k - 1].tie && S[k - 1].bar === sl.bar - 1 && cp[k - 1] && tiedVert(ex, sl.bar, cp[k - 1]).dn === 1)) push('unison', [k], `A unison in the middle merges the voices. Keep unisons for the beginning and end. (A 2–1 suspension may resolve onto one.)`);
      if (k === L - 2 && v.dn >= 0) {
        const want = ex.above ? { g: 5, s: 9 } : { g: 2, s: 3 };
        if (!(v.g === want.g && v.s === want.s)) {
          let msg = `The cadence: ${ex.above ? 'a 7th suspension resolving to a major 6th' : 'a 2nd suspension resolving to a minor 3rd'}, then the final.`;
          if (v.g === want.g) msg = `Raise the leading tone: at the cadence ${cN} should be ${noteName({ d: c.d, alt: c.alt + (want.s - v.s) * (ex.above ? 1 : -1) })}.`;
          push('cadence', [k], msg);
        }
      }
      if (c.alt !== sig[letterOf(c.d)] && k !== L - 2) push('chromatic', [k], `${cN} is outside the mode. Use chromatic notes only for the raised leading tone at the cadence.`, 'warn');
      // The tied half note against the next cantus note.
      if (sl.tie) {
        const tv = tiedVert(ex, b + 1, c);
        if (ex.above ? midi(c) < midi(ex.cf[b + 1]) : midi(c) > midi(ex.cf[b + 1])) push('crossing', [k], `Tied into bar ${b + 2}, your ${cN} crosses the cantus.`, 'warn');
        else if (!tv.consonant) {
          const okType = ex.above ? (tv.g === 6 || tv.g === 3 || tv.g === 1) : tv.g === 1;
          if (!okType) push('suspension', [k], ex.above
            ? `Tied into bar ${b + 2}, ${cN} makes ${describe(tv)}. Above the cantus use the 7–6 or 4–3 suspension.`
            : `Tied into bar ${b + 2}, ${cN} makes ${describe(tv)}. Below the cantus the suspension to use is 2–3.`);
          else if (tv.g === 1 && ex.above && v.consonant && ((tv.dn === 1 && v.dn === 0) || (tv.dn === 8 && v.dn === 7))) push('suspension', [k], tv.dn === 1
            ? `A 2–1 suspension needs a note other than the unison before it: with the tie taken away you would have two unisons in a row (Fux, p. 57).`
            : `A 9–8 suspension needs a note other than the octave before it: with the tie taken away you would have two octaves in a row (Fux, p. 57).`);
          else if (tv.g === 1 && ex.above && tv.dn >= 7) push('suspension', [k], `A 9–8 suspension resolves onto an octave, which sounds hollow. Prefer 7–6 or 4–3.`, 'warn');
          const q = cp[k + 1];
          if (q) {
            const m = melodic(c, q);
            if (!(m.step && m.dir < 0)) push('suspension', [k, k + 1], `The suspended ${cN} is a dissonance in bar ${b + 2}: it must resolve down by step, to ${noteName({ d: c.d - 1, alt: sig[letterOf(c.d - 1)] })}.`);
          }
        }
      }
      const p = k > 0 && cp[k - 1];
      if (p) {
        const m = melodic(p, c);
        if (m.ag === 0) push('repeat', [k - 1, k], `Repeated note (${cN}). After a tie, move to a new note.`);
        else if (!m.ok) push('melodic', [k - 1, k], `The leap ${noteName(p)} → ${cN} is ${m.ag === 5 && m.dir < 0 ? 'a descending 6th' : describe(m.iv)}, which is hard to sing.`);
        const pv = vertN(ex, S[k - 1], p);
        if (v.perfect && pv.perfect && v.g === pv.g && v.dn > 0 && k < L - 1) push('parallel', [k - 1, k], sl.broken || S[k - 1].broken ? `Parallel ${v.g === 4 ? 'fifths' : 'octaves'} (${describe(pv)} to ${describe(v)}) where the tie is broken.` : `${v.g === 4 ? 'Fifths' : 'Octaves'} on successive second halves (${describe(pv)} to ${describe(v)}). The syncopation does not hide these parallels.`);
        if (sl.broken && v.perfect && v.dn > 0) { const mc = midi(c) - midi(p), mf = midi(ex.cf[b]) - midi(ex.cf[S[k - 1].bar]); if (mc && mf && Math.sign(mc) === Math.sign(mf) && !(pv.perfect && v.g === pv.g)) push('direct', [k - 1, k], `Direct ${v.g === 4 ? 'fifth' : 'octave'}: both voices move the same way into ${describe(v)} on the downbeat.`); }
      }
    }
    const nb = (ex.breaks || []).filter(Boolean).length;
    if (nb > 1) push('breaking', S.map((sl, k) => sl.broken ? k : -1).filter(k => k >= 0), `The species is broken ${nb} times. Fux breaks the chain of ties only when nothing else works, once in an exercise at most.`, 'warn');
    return out;
  }
  function errorsN(ex, cp) {
    const out = errorsNcore(ex, cp), S = slotsN(ex);
    cp.forEach((c, k) => {
      if (!c) return;
      const v = vertN(ex, S[k], c), cfN = ex.cf[S[k].bar];
      if (v.g === 0 && v.s !== 0) out.push({ sev: 'error', rule: 'clash', cols: [k], msg: `${noteName(c)} against ${noteName(cfN)} in bar ${S[k].bar + 1}: a note against its own ${v.s * (ex.above ? 1 : -1) > 0 ? 'sharp' : 'flat'}. That clash is never allowed, not even as a passing note.` });
    });
    return out;
  }
  function errorsNcore(ex, cp) {
    if (ex.species === 4) return errors4(ex, cp);
    if (ex.species === 5) return errors5(ex, cp);
    const S = slotsN(ex), L = S.length, sig = signature(ex.key), out = [], sp = ex.species, unit = sp === 3 ? 'quarter' : 'half';
    const push = (rule, cols, msg, sev = 'error') => out.push({ sev, rule, cols, msg });
    for (let k = 0; k < L; k++) {
      const c = cp[k]; if (!c) continue;
      const sl = S[k], v = vertN(ex, sl, c), cfN = noteName(ex.cf[sl.bar]), cN = noteName(c);
      const where = sl.whole ? 'the last bar' : sl.dur === 4 ? `bar ${sl.bar + 1}` : `bar ${sl.bar + 1}, ${BEAT_WORDS[sl.beat]} ${unit}`;
      if (ex.above ? midi(c) < midi(ex.cf[sl.bar]) : midi(c) > midi(ex.cf[sl.bar])) push('crossing', [k], `The voices cross in ${where}: your ${cN} is ${ex.above ? 'below' : 'above'} the cantus (${cfN}). Fux allows a brief crossing to avoid a worse progression.`, 'warn');
      if (v.dn > 11) push('spacing', [k], `The voices are more than a 12th apart in ${where}. Keep them within a 10th where you can.`);
      if (k === 0) {
        const ok = v.consonant && (ex.above ? v.perfect : v.perfect && v.g === 0);
        if (!ok) push('start', [0], ex.above ? `After the opening rest, begin on a perfect consonance (unison, 5th or octave). You wrote ${describe(v)}.` : `Below the cantus, begin on a unison or octave. You wrote ${describe(v)}.`);
      } else if (k === L - 1) {
        if (!(v.consonant && v.perfect && v.g === 0)) push('end', [k], `End on a unison or octave with the cantus. You ended on ${describe(v)}.`);
      } else if (sl.strong) {
        if (!v.consonant) push('dissonance', [k], `${cN} against ${cfN} makes ${describe(v)} on the downbeat. Every downbeat must be consonant.`);
        else if (v.dn === 0 && v.s === 0) push('unison', [k], `A unison on a downbeat merges the voices. Keep unisons for the beginning and end.`);
      } else if (!v.consonant) {
        const p = cp[k - 1], q = cp[k + 1], r = cp[k + 2];
        const mp = p && melodic(p, c), mq = q && melodic(c, q);
        let ok = true, pending = !q;
        if (mp && !mp.step) {
          ok = false;
        } else if (sp === 2) {
          ok = !mq || (mq.step && (!mp || mq.dir === mp.dir));
        } else {
          // Third species: passing tones anywhere; neighbours on the 2nd and 4th quarter; the cambiata on the 2nd.
          const passing = mq && mq.step && (!mp || mq.dir === mp.dir);
          const neighbour = mq && mq.step && mp && mq.dir !== mp.dir && sl.beat !== 2;
          const cambiata = sl.beat === 1 && mp && mp.dir < 0 && mq && mq.ag === 2 && mq.dir < 0 && (!r || (melodic(q, r).step && melodic(q, r).dir > 0));
          ok = pending || passing || neighbour || cambiata;
        }
        if (!ok) push('passing', [k - 1, k, k + 1].filter(i => cp[i]), sp === 2
          ? `${cN} against ${cfN} is ${describe(v)}. A dissonance on the second half is allowed only as a passing tone: reached by step and left by step in the same direction.`
          : `${cN} against ${cfN} is ${describe(v)}. A dissonant quarter must be a passing tone, a neighbour note on the 2nd or 4th quarter, or a cambiata (step down, then a 3rd down, then a step up).`);
      }
      if (k === L - 2 && v.dn >= 0) {
        const want = ex.above ? { g: 5, s: 9 } : { g: 2, s: 3 };
        if (!(v.g === want.g && v.s === want.s)) {
          let msg = `The cadence: the last ${unit} note before the final should make ${ex.above ? 'a major 6th above' : 'a minor 3rd below'} the cantus and move by step to the final.`;
          if (v.g === want.g) msg = `Raise the leading tone: at the cadence ${cN} should be ${noteName({ d: c.d, alt: c.alt + (want.s - v.s) * (ex.above ? 1 : -1) })}.`;
          push('cadence', [k], msg);
        }
      }
      if (c.alt !== sig[letterOf(c.d)] && k !== L - 2) push('chromatic', [k], `${cN} is outside the mode. Use chromatic notes only for the raised leading tone at the cadence.`, 'warn');
      const p = k > 0 && cp[k - 1];
      if (p) {
        const m = melodic(p, c);
        if (m.ag === 0) push('repeat', [k - 1, k], `Repeated note (${cN}). In ${sp === 3 ? 'third' : 'second'} species the line keeps moving: no repeated notes.`);
        else if (!m.ok) push('melodic', [k - 1, k], `The leap ${noteName(p)} → ${cN} is ${m.ag === 5 && m.dir < 0 ? 'a descending 6th' : describe(m.iv)}, which is hard to sing.`);
        if (sl.strong) {
          // Across the barline both voices move: same checks as first species.
          const pv = vertN(ex, S[k - 1], p), mc = midi(c) - midi(p), mf = midi(ex.cf[sl.bar]) - midi(ex.cf[S[k - 1].bar]);
          if (v.perfect && pv.perfect && v.g === pv.g && mc && mf) push('parallel', [k - 1, k], `Parallel ${v.g === 4 ? 'fifths' : 'octaves'} across the barline: ${describe(pv)} moves to ${describe(v)} with both voices moving.`);
          else if (v.perfect && v.dn > 0 && mc && mf && Math.sign(mc) === Math.sign(mf)) push('direct', [k - 1, k], `Direct ${v.g === 4 ? 'fifth' : 'octave'}: both voices move the same way into ${describe(v)} on the downbeat. Approach it by contrary motion.`);
          // Perfect intervals on successive downbeats are heard as parallels.
          const ps = S.findIndex((x, i) => i < k && x.bar === sl.bar - 1 && x.strong);
          if (ps >= 0 && cp[ps]) {
            const dv = vertN(ex, S[ps], cp[ps]);
            // Fux (p. 43-44): a skip of a third cannot hide the parallel, but a skip of a fourth or more can; the ear forgets the first downbeat.
            const wk = sp === 2 && cp[ps + 1] && ps + 1 < k ? cp[ps + 1] : null;
            const forgot = !!wk && (melodic(cp[ps], wk).ag >= 3 || melodic(wk, c).ag >= 3);
            if (v.perfect && dv.perfect && v.g === dv.g && v.dn > 0 && !forgot) push('downbeats', [ps, k], sp === 3
              ? `${v.g === 4 ? 'Fifths' : 'Octaves'} on successive downbeats. With three quarters between them they are less obvious, but still worth avoiding.`
              : `${v.g === 4 ? 'Fifths' : 'Octaves'} on successive downbeats: the weak note between them does not hide the parallel. Change one of the downbeats.`, sp === 3 ? 'warn' : 'error');
          }
        }
      }
    }
    return out;
  }
  function checkN(ex, cp) {
    const S = slotsN(ex), L = S.length, issues = errorsN(ex, cp).concat(outlines(cp, 'line'));
    const figures = cp.map((c, k) => c ? vertN(ex, S[k], c) : null);
    const filled = cp.filter(Boolean).length, complete = filled === L;
    const notes = cp.map((c, i) => c && { ...c, i }).filter(Boolean);
    const moves = [];
    for (let k = 1; k < notes.length; k++) if (notes[k].i === notes[k - 1].i + 1) moves.push({ a: notes[k - 1], b: notes[k], m: melodic(notes[k - 1], notes[k]) });
    for (let k = 1; k < moves.length; k++) {
      const a = moves[k - 1], b = moves[k];
      if (b.a.i !== a.b.i) continue;
      if (a.m.bigLeap && !(b.m.step && b.m.dir === -a.m.dir)) issues.push({ sev: 'warn', rule: 'recovery', cols: [a.a.i, a.b.i, b.b.i], msg: `After the leap ${noteName(a.a)} → ${noteName(a.b)}, step back in the opposite direction.` });
      else if (a.m.leap && b.m.leap && a.m.dir === b.m.dir) issues.push({ sev: 'warn', rule: 'double-leap', cols: [a.a.i, a.b.i, b.b.i], msg: `Two leaps in the same direction (${noteName(a.a)} → ${noteName(a.b)} → ${noteName(b.b)}). Follow a leap with a step.` });
    }
    // Melodic sequences (monotonia): Fux asks to avoid them as far as possible (p. 54, note). A figure of two or three
    // moves that is simply repeated at once, and is not a plain scale run, stalls the line.
    {
      const runs = []; let cur = [];
      moves.forEach(mv => { if (cur.length && cur[cur.length - 1].b.i !== mv.a.i) { runs.push(cur); cur = []; } cur.push(mv); });
      if (cur.length) runs.push(cur);
      const seen = new Set();
      runs.forEach(rn => {
        let lastEnd = -1;
        for (let L2 = 2; L2 <= 3; L2++) for (let j = 0; j + (L2 === 2 ? 3 : 2) * L2 <= rn.length; j++) {
          const reps = L2 === 2 ? 3 : 2, w = rn.slice(j, j + reps * L2).map(x => x.m.g);
          if (w.length < reps * L2 || new Set(w).size < 2 || !w.every((g, q) => g === w[q % L2])) continue;
          if (w.every(g => Math.abs(g) === 1)) continue;
          if (j < lastEnd) continue; lastEnd = j + reps * L2;
          const start = rn[j].a.i, key = start + ':' + L2; if (seen.has(key)) continue; seen.add(key);
          issues.push({ sev: 'warn', rule: 'sequence', cols: rn.slice(j, j + reps * L2).map(x => x.b.i).concat([start]), msg: `The same ${L2}-move figure repeats from ${noteName(rn[j].a)}. A melodic sequence makes the line monotonous: change the shape the second time.` });
        }
      });
    }
    const strengths = [];
    if (complete && notes.length >= 3) {
      const ext = ex.above ? Math.max(...notes.map(midi)) : Math.min(...notes.map(midi));
      const peak = notes.filter(x => midi(x) === ext);
      if (peak.length > 1) issues.push({ sev: 'warn', rule: 'climax', cols: peak.map(x => x.i), msg: `Your ${ex.above ? 'highest' : 'lowest'} note (${noteName(peak[0])}) appears ${peak.length} times. A single climax gives the line a shape.` });
      else strengths.push({ rule: 'climax', cols: [peak[0].i], msg: `One clear climax (${noteName(peak[0])}) gives the line a shape.` });
      const range = Math.max(...notes.map(x => x.d)) - Math.min(...notes.map(x => x.d));
      if (range > 10) issues.push({ sev: 'warn', rule: 'range', cols: [], msg: `The line spans more than an 11th. Keep it within a singer's range.` });
      const steps = moves.filter(x => x.m.step).length / (moves.length || 1);
      if (steps < (ex.species === 3 ? 0.6 : 0.5)) issues.push({ sev: 'warn', rule: 'steps', cols: [], msg: `Only ${Math.round(steps * 100)}% of your moves are steps. ${ex.species === 3 ? 'Quarter notes' : 'Half notes'} flow best when they move mostly by step.` });
      else strengths.push({ rule: 'steps', cols: [], msg: `Mostly stepwise (${Math.round(steps * 100)}% steps): the line flows.` });
      if (ex.species === 4 || ex.species === 5) {
        const sus = S.filter((sl, k) => sl.tie && cp[k] && !tiedVert(ex, sl.bar + 1, cp[k]).consonant).length;
        if (sus) strengths.push({ rule: 'suspension', cols: [], msg: `${sus} ${sus === 1 ? 'suspension' : 'suspensions'}, each prepared and resolved down by step.` });
        else if (ex.species === 4) issues.push({ sev: 'warn', rule: 'suspension', cols: [], msg: `No suspensions: every tie lands on a consonance. Fourth species is about suspended dissonances; try a 7–6 or 4–3 above (2–3 below).` });
      }
      const passing = ex.species === 4 ? 0 : figures.filter((f, k) => f && !f.consonant && !S[k].strong).length;
      if (passing) strengths.push({ rule: 'passing', cols: [], msg: `${passing} dissonant ${passing === 1 ? 'note' : 'notes'} on weak beats, each one handled the way ${ex.species === 3 ? 'third' : 'second'} species allows.` });
    }
    const errors = issues.filter(x => x.sev === 'error'), warns = issues.filter(x => x.sev === 'warn');
    return { issues, errors, warns, strengths, figures, complete, filled, shape: complete ? Math.max(20, 100 - 10 * warns.length) : null, slots: S };
  }
  const errorsAtN = (ex, cp, k) => errorsN(ex, cp).filter(e => e.sev === 'error' && e.cols.includes(k));
  function allowedN(ex, cp, k) {
    const S = slotsN(ex), sig = signature(ex.key), out = [], base = ex.cf[S[k].bar].d;
    for (let j = 0; j <= 12; j++) {
      const d = ex.above ? base + j : base - j;
      const tries = [{ d, alt: sig[letterOf(d)] }];
      if (k === S.length - 2) tries.push({ d, alt: sig[letterOf(d)] + 1 });
      for (const c of tries) {
        if (Math.abs(c.alt) > 1) continue;
        const t = cp.slice(); t[k] = c;
        if (!errorsAtN(ex, t, k).length) { out.push(c); break; }
      }
    }
    // Keep only notes that leave the line finishable (a dissonance needs somewhere to go).
    const candsN = (t, j) => { const b = ex.cf[S[j].bar].d, r = []; for (let q = 0; q <= 11; q++) { const d = ex.above ? b + q : b - q; r.push({ d, alt: sig[letterOf(d)] }); if (j === S.length - 2) r.push({ d, alt: sig[letterOf(d)] + 1 }); } return nearFirst(t, j, r.filter(c => Math.abs(c.alt) <= 1)); };
    const keep = out.filter(c => { const t = cp.slice(); t[k] = c; return canContinue(t, k, tt => errorsN(ex, tt), candsN, ex.species === 5 ? 80 : 50, ex.species === 5 ? 6 : 4, [S.length - 2, S.length - 1]); });
    return keep.length ? keep : out;
  }
  function solveN(ex, r, limitMs = 300) {
    const S = slotsN(ex), L = S.length, sig = signature(ex.key), t0 = Date.now();
    const cp = new Array(L).fill(null);
    let found = null;
    const cands = k => {
      const base = ex.cf[S[k].bar].d, out = [];
      for (let j = 0; j <= 11; j++) {
        const d = ex.above ? base + j : base - j;
        out.push({ d, alt: sig[letterOf(d)] });
        if (k === L - 2) out.push({ d, alt: sig[letterOf(d)] + 1 });
      }
      const prev = cp[k - 1];
      // Prefer steps from the previous note, then small leaps.
      const stepOnly = prev && (S[k].dur === 0.5 || (S[k - 1] && S[k - 1].dur === 0.5));
      const pool = shuffle(out.filter(c => Math.abs(c.alt) <= 1 && (!prev || Math.abs(c.d - prev.d) <= (stepOnly ? 1 : 4))), r);
      // Fourth species: try resolving down a step first, so suspensions chain naturally.
      if ((ex.species === 4 || (ex.species === 5 && S[k - 1] && S[k - 1].tie)) && prev) return pool.sort((a, b) => (a.d === prev.d - 1 ? -1 : 0) - (b.d === prev.d - 1 ? -1 : 0) || Math.abs(a.d - prev.d) - Math.abs(b.d - prev.d));
      return pool.sort((a, b) => prev ? Math.abs(a.d - prev.d) - Math.abs(b.d - prev.d) : 0);
    };
    (function dfs(k) {
      if (found || Date.now() - t0 > limitMs) return;
      if (k === L) { found = cp.slice(); return; }
      for (const c of cands(k)) {
        cp[k] = c;
        const errs = errorsN(ex, cp).filter(e => e.sev === 'error' && e.cols.some(i => i >= k - 1));
        if (!errs.length) dfs(k + 1);
        if (found) return;
      }
      cp[k] = null;
    })(0);
    return found && !checkN(ex, found).errors.length ? found : null;
  }
  // Older names, kept for callers written for second species.
  const slots2 = slotsN, check2 = checkN, allowed2 = allowedN, solve2 = solveN;

  // Lookahead for the hints: after writing c at k, can the next empty notes still be filled without a rule error?
  // Near the end it looks all the way to the final (the cadence is where lines get stuck); elsewhere a few notes ahead.
  // A search that runs out of time counts as fine, so hints never vanish just because the search was slow.
  function canContinue(cp, k, errsOf, candsFor, budgetMs = 25, depth = 3, tail = []) {
    const L = cp.length, t0 = Date.now(), empties = [];
    for (let j = k + 1; j < L; j++) if (!cp[j]) empties.push(j);
    // The next few empty places, plus the cadence places at the end, so a note that spoils the ending is caught early.
    const targets = empties.length <= 6 ? empties : [...new Set(tail.filter(j => empties.includes(j)).concat(empties.slice(0, depth)))]; // the most binding places first
    const t = cp.slice();
    let ok = false, late = false;
    (function dfs(i) {
      if (ok || late) return;
      if (Date.now() - t0 > budgetMs) { late = true; return; }
      if (i === targets.length) { ok = true; return; }
      const j = targets[i];
      for (const c of candsFor(t, j)) {
        t[j] = c;
        if (!errsOf(t).some(e => e.sev === 'error' && e.cols.includes(j) && e.cols.every(x => t[x]))) dfs(i + 1);
        if (ok || late) return;
      }
      t[j] = null;
    })(0);
    return ok || late;
  }
  const nearFirst = (t, j, list) => { let p = null; for (let i = j - 1; i >= 0; i--) if (t[i]) { p = t[i]; break; } return p ? list.slice().sort((a, b) => Math.abs(a.d - p.d) - Math.abs(b.d - p.d)) : list; };

  // Notes that can go in bar i without breaking a rule here or with the next written note.
  function allowed(ex, cp, i) {
    const sig = signature(ex.key), n = ex.cf.length, out = [], base = ex.cf[i].d;
    for (let k = 0; k <= 12; k++) {
      const d = ex.above ? base + k : base - k;
      const tries = [{ d, alt: sig[letterOf(d)] }];
      if (i === n - 2) tries.push({ d, alt: sig[letterOf(d)] + 1 });
      for (const c of tries) {
        if (Math.abs(c.alt) > 1) continue;
        const t = cp.slice(); t[i] = c;
        const bad = localErrors(ex, t, i).some(e => e.sev === 'error') || (i + 1 < n && t[i + 1] && localErrors(ex, t, i + 1).some(e => e.sev === 'error'));
        if (!bad) { out.push(c); break; }
      }
    }
    // Keep only notes that leave the line finishable.
    const cands1 = j => { const r = [], b = ex.cf[j].d; for (let k = 0; k <= 11; k++) { const d = ex.above ? b + k : b - k; r.push({ d, alt: sig[letterOf(d)] }); if (j === n - 2) r.push({ d, alt: sig[letterOf(d)] + 1 }); } return r.filter(c => Math.abs(c.alt) <= 1); };
    const pools = ex.cf.map((_, j) => cands1(j));
    const errs1 = t => { const e = []; for (let j = 0; j < n; j++) if (t[j]) e.push(...localErrors(ex, t, j)); return e; };
    const keep = out.filter(c => { const t = cp.slice(); t[i] = c; return canContinue(t, i, errs1, (tt, j) => nearFirst(tt, j, pools[j])); });
    return keep.length ? keep : out;
  }

  // ================= Three and four voices =================
  // ex = { kind: 'multi', key, cf, V, cv (cantus voice, 0 = top), sp (species of the florid voice), fv (florid voice or -1),
  //        rh, ties, breaks (the florid voice's plan) }. The student's notes are one flat list over the editable voices,
  // voice by voice from the top; each slot carries its voice.
  const RANGES = { 3: [[60, 79], [48, 67], [40, 60]], 4: [[60, 79], [55, 74], [48, 67], [40, 60]] };
  const VOICE_NAMES = { 3: ['Upper voice', 'Middle voice', 'Bass'], 4: ['Soprano', 'Alto', 'Tenor', 'Bass'] };
  function mslots(ex) {
    const out = [], n = ex.cf.length;
    for (let v = 0; v < ex.V; v++) {
      if (v === ex.cv) continue;
      if (v === ex.fv) slotsN({ cf: ex.cf, species: ex.sp, rh: ex.rh, ties: ex.ties, breaks: ex.breaks }).forEach(s => out.push(Object.assign({}, s, { voice: v })));
      else for (let b = 0; b < n; b++) out.push({ voice: v, bar: b, on: 0, dur: 4, n: 1, beat: 0, strong: true, whole: true });
    }
    return out;
  }
  // The note each voice sounds at a moment (bar, on): { n, k (slot index, -1 for the cantus), attack, tied }.
  function sounding(ex, MS, cp, byVoice) {
    return (v, bar, on) => {
      if (v === ex.cv) return { n: ex.cf[bar], k: -1, attack: on === 0 };
      for (const k of byVoice[v]) { const s = MS[k]; if (s.bar === bar && on >= s.on - 1e-9 && on < s.on + s.dur - 1e-9) return { n: cp[k], k, attack: Math.abs(on - s.on) < 1e-9, s }; }
      for (const k of byVoice[v]) { const s = MS[k]; if (s.tie && s.bar === bar - 1 && on < 2 - 1e-9) return { n: cp[k], k, attack: false, tied: true, s }; }
      return null;
    };
  }
  const pcSame = (a, b) => a && b && (((a.d - b.d) % 7) + 7) % 7 === 0 && a.alt === b.alt;
  // One line of advice per soft rule, shown as "It would be better to ...".
  const WEIGHT = { climax: 3, recovery: 3, 'double-leap': 3, outline: 2, range: 2, steps: 2, repeat: 2, crossing: 2, doubling: 2, unison: 2, hollow: 2, chromatic: 2, breaking: 2, sequence: 1, rhythm: 1, eighths: 1, spread: 1, spacing: 1, tritone: 1, melodic: 1, contrary: 1, 'parallel-run': 1, suspension: 1 };
  const TIPS = {
    crossing: 'keep the line on its own side of the cantus', chromatic: 'stay with the notes of the mode', outline: 'turn back before the tritone is reached',
    repeat: 'move on by step instead of repeating the note', recovery: 'step back the other way after a leap', 'double-leap': 'follow a leap with a step',
    'parallel-run': 'break the run of 3rds or 6ths with contrary motion', climax: 'give the line one clear high point', range: 'keep the line within a singable range',
    steps: 'move mostly by step', contrary: 'use contrary motion more often', hollow: 'give the chord a 3rd or a 6th', sequence: 'change the shape of the figure the second time',
    suspension: 'use a 7–6 or 4–3 suspension', eighths: 'put eighths in pairs on the 2nd or 4th quarter', rhythm: 'vary the rhythm from bar to bar', breaking: 'keep the chain of ties unbroken',
    tritone: 'prefer a 3rd, 4th or 6th between the upper voices', spacing: 'keep the upper voices within an octave of each other', unison: 'avoid the unison in the middle of the exercise',
    spread: 'put the 5th low and the 3rd high', doubling: 'double the octave or the 3rd', melodic: 'keep the leaps small', imperfect: 'use more 3rds and 6ths', passing: 'handle the dissonance as a passing note',
    downbeats: 'change one of the downbeats'
  };
  const simple = iv => iv.dn === 0 ? 1 : iv.g === 0 ? 8 : iv.g + 1;
  // Is a weak-beat dissonance in the florid voice handled the way its note value allows?
  function weakOk(MS, cp, idx, j) {
    const k = idx[j], s = MS[k], c = cp[k], p = j > 0 ? cp[idx[j - 1]] : null, q = j + 1 < idx.length ? cp[idx[j + 1]] : null, r = j + 2 < idx.length ? cp[idx[j + 2]] : null;
    const mp = p && melodic(p, c), mq = q && melodic(c, q);
    if (mp && !mp.step) {
      // the cambiata's third note is consonant; a dissonance reached by leap is wrong
      return false;
    }
    if (!q) return true;
    if (s.dur === 0.5) return mq.step;
    if (s.dur === 1) {
      const passing = mq.step && (!mp || mq.dir === mp.dir);
      const neighbour = mq.step && mp && mq.dir !== mp.dir && (s.on === 1 || s.on === 3);
      const cambiata = s.on === 1 && mp && mp.dir < 0 && mq.ag === 2 && mq.dir < 0 && (!r || (melodic(q, r).step && melodic(q, r).dir > 0));
      return passing || neighbour || cambiata;
    }
    return mq.step && (!mp || mq.dir === mp.dir);
  }
  function checkMulti(ex, cp) {
    const V = ex.V, n = ex.cf.length, MS = mslots(ex), sig = signature(ex.key), issues = [], strengths = [];
    const push = (rule, cols, msg, sev = 'error') => { cols = [...new Set(cols.filter(k => k >= 0))]; if (!issues.some(x => x.rule === rule && x.msg === msg)) issues.push({ sev, rule, cols, msg }); };
    const byVoice = Array.from({ length: V }, () => []);
    MS.forEach((s, k) => byVoice[s.voice].push(k));
    const at = sounding(ex, MS, cp, byVoice), names = VOICE_NAMES[V];
    const nm = v => names[v].toLowerCase();
    const final = ex.final, lt = { d: final.d - 1 };
    const phryg = ex.key.mode === 'phrygian';
    // Moments: every downbeat, plus each florid attack.
    const moments = [];
    for (let b = 0; b < n; b++) {
      const ons = new Set([0]);
      if (ex.fv >= 0) byVoice[ex.fv].forEach(k => { if (MS[k].bar === b) ons.add(MS[k].on); });
      [...ons].sort((a, c) => a - c).forEach(on => moments.push({ b, on }));
    }
    const figures = new Array(n).fill(null);
    let prev = null;
    for (const m of moments) {
      const snd = Array.from({ length: V }, (_, v) => at(v, m.b, m.on));
      const present = snd.map((x, v) => x && x.n ? v : -1).filter(v => v >= 0);
      if (!present.length) { prev = null; continue; }
      const low = present.reduce((a, v) => midi(snd[v].n) < midi(snd[a].n) ? v : a, present[0]);
      const bass = snd[low].n;
      // Vertical: every pair of voices.
      for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
        const a = present[i], c = present[j], na = snd[a].n, nc = snd[c].n;
        const [lo, hi] = midi(na) <= midi(nc) ? [na, nc] : [nc, na], loV = midi(na) <= midi(nc) ? a : c;
        const iv = interval(lo, hi), withBass = midi(lo) === midi(bass) && loV === low;
        // A note against its own sharp or flat (augmented unison or octave) is never usable, passing or not.
        if (iv.g === 0 && iv.s !== 0) { push('clash', [snd[a].k, snd[c].k], `${noteName(snd[a].n)} in the ${nm(a)} against ${noteName(snd[c].n)} in the ${nm(c)} in bar ${m.b + 1}: a note and its ${iv.s > 0 === midi(snd[a].n) < midi(snd[c].n) ? 'sharp' : 'flat'} at once. Two voices may never clash like this.`); continue; }
        const fourth = iv.g === 3 && iv.q === 'P', tritone = (iv.g === 3 && iv.q === 'A') || (iv.g === 4 && iv.q === 'd');
        let diss = !iv.consonant;
        if (!withBass && fourth) diss = false; // a 4th between upper voices is fine
        if (!withBass && tritone) { if (m.on === 0) push('tritone', [snd[a].k, snd[c].k], `A tritone between the ${nm(a)} and the ${nm(c)} in bar ${m.b + 1}. Between upper voices it is allowed, but it sounds tense; prefer a 3rd, 4th or 6th.`, 'warn'); diss = false; }
        if (!diss) continue;
        const cols = [snd[a].k, snd[c].k];
        // Who made the dissonance? Only the florid voice may, and only in the ways its species allows.
        const fl = [a, c].find(v => v === ex.fv);
        const what = `${noteName(snd[a].n)} in the ${nm(a)} against ${noteName(snd[c].n)} in the ${nm(c)} make ${describe(iv)}`;
        if (fl === undefined || (snd[fl].attack && m.on === 0)) { push('dissonance', cols, `${what} in bar ${m.b + 1}. Every chord on the beat must be consonant${withBass && fourth ? ': a 4th above the bass counts as a dissonance' : ''}.`); continue; }
        const f = snd[fl], idx = byVoice[fl], fj = idx.indexOf(f.k);
        if (f.tied) {
          // A suspension: the tied note must fall a step to resolve.
          const nx = fj + 1 < idx.length ? cp[idx[fj + 1]] : null;
          if (nx && !(nx.d === f.n.d - 1)) push('suspension', [f.k, idx[fj + 1]], `${what} on the downbeat of bar ${m.b + 1}: a suspension, so ${noteName(f.n)} must resolve down by step.`);
          if (fl === low && !(iv.g === 1)) push('suspension', [f.k], `A suspension in the bass works as 2–3: the upper note should make a 2nd (or 9th) with it.`, 'warn');
          continue;
        }
        if (ex.sp === 4) { push('dissonance', cols, `${what} in bar ${m.b + 1}. In fourth species the note struck on the second half must be consonant.`); continue; }
        if (!weakOk(MS, cp, idx, fj)) push('passing', [idx[fj - 1], f.k, idx[fj + 1]], `${what} in bar ${m.b + 1}. A dissonance off the beat must pass by step${ex.sp >= 3 ? ', or be a neighbour note or cambiata' : ''}.`);
      }
      // Parallels and direct fifths/octaves between moments.
      if (prev) {
        for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
          const a = present[i], c = present[j], pa = prev.snd[a], pc = prev.snd[c];
          if (!pa || !pc || !pa.n || !pc.n) continue;
          const ma = midi(snd[a].n) - midi(pa.n), mc = midi(snd[c].n) - midi(pc.n);
          if (!ma || !mc) continue;
          const ivOf = (x, y) => midi(x) <= midi(y) ? interval(x, y) : interval(y, x);
          const v1 = ivOf(pa.n, pc.n), v2 = ivOf(snd[a].n, snd[c].n);
          if (v1.perfect && v2.perfect && v1.g === v2.g && Math.sign(ma) === Math.sign(mc)) push('parallel', [pa.k, pc.k, snd[a].k, snd[c].k], `Parallel ${v2.g === 4 ? 'fifths' : 'octaves'} between the ${nm(a)} and the ${nm(c)} (bar ${prev.b + 1} to ${m.b + 1}).`);
          else if (v2.perfect && m.on === 0 && Math.sign(ma) === Math.sign(mc) && a === 0 && c === V - 1 && Math.abs(snd[a].n.d - pa.n.d) > 1) push('direct', [snd[a].k, snd[c].k], `Direct ${v2.g === 4 ? 'fifth' : 'octave'} between the outer voices in bar ${m.b + 1}: both move the same way and the top voice leaps.`);
        }
      }
      // Crossing, at any moment both voices sound: a voice that dips below the bass changes the harmony, so that is an error.
      for (let v = 0; v + 1 < V; v++) for (let w = v + 1; w < V; w++) {
        if (!snd[v] || !snd[w] || !snd[v].n || !snd[w].n || midi(snd[v].n) >= midi(snd[w].n)) continue;
        if (w === V - 1) push('crossing', [snd[v].k, snd[w].k], `The ${nm(v)} goes below the bass in bar ${m.b + 1}. The bass must stay the lowest voice.`);
        else push('crossing', [snd[v].k, snd[w].k], `The ${nm(v)} goes below the ${nm(w)} in bar ${m.b + 1}. Keep the voices in order; cross only briefly, if at all.`, 'warn');
      }
      // Downbeat chords: spacing, completeness, figures.
      if (m.on === 0 && present.length === V) {
        for (let v = 0; v + 1 < V; v++) {
          if (v + 1 < V - 1 && midi(snd[v].n) - midi(snd[v + 1].n) > 12) push('spacing', [snd[v].k, snd[v + 1].k], `More than an octave between the ${nm(v)} and the ${nm(v + 1)} in bar ${m.b + 1}. Keep upper voices within an octave of each other.`, 'warn');
        }
        const ivs = present.filter(v => v !== low).map(v => interval(bass, snd[v].n));
        figures[m.b] = [...new Set(ivs.map(simple))].sort((x, y) => y - x);
        const third = ivs.some(iv => iv.g === 2 || iv.g === 5);
        if (m.b > 0 && m.b < n - 1 && !third) push('hollow', present.map(v => snd[v].k), `Bar ${m.b + 1} has no 3rd or 6th above the bass. The chord sounds hollow; give one voice the 3rd.`, 'warn');
        const lts = present.filter(v => pcSame(snd[v].n, { d: lt.d, alt: snd[v].n.alt }) && snd[v].n.alt > sig[letterOf(snd[v].n.d)]);
        if (lts.length > 1) push('doubling', lts.map(v => snd[v].k), `The raised leading tone is doubled in bar ${m.b + 1}. Only one voice should have it.`);
        const uni = present.filter((v, i) => present.some((w, k) => k < i && midi(snd[w].n) === midi(snd[v].n)));
        if (m.b > 0 && m.b < n - 1 && uni.length) push('unison', uni.map(v => snd[v].k), `Two voices meet on a unison in bar ${m.b + 1}. Use it sparingly in the middle.`, 'warn');
        if (m.b > 0 && m.b < n - 1 && V >= 3) {
          const ups = present.filter(v => v !== low).map(v => ({ v, iv: interval(bass, snd[v].n) })).sort((a, c) => midi(snd[a.v].n) - midi(snd[c.v].n));
          // Fux: a 3rd right above the bass sounds dull; the 5th low and the 3rd high sounds fuller.
          if (ups[0] && ups[0].iv.dn === 2 && ups.slice(1).some(u => u.iv.g === 4 || (u.iv.g === 0 && u.iv.dn > 0)))
            push('spread', [snd[ups[0].v].k, snd[low].k], `In bar ${m.b + 1} the ${nm(ups[0].v)} sits a 3rd above the bass, which sounds dull (Fux). Put the 5th low and the 3rd high instead.`, 'warn');
          // Double the octave first, then the 3rd; the 5th or 6th only rarely.
          const byPc = new Map();
          ups.forEach(u => { const k = ((snd[u.v].n.d % 7) + 7) % 7; (byPc.get(k) || byPc.set(k, []).get(k)).push(u); });
          for (const grp of byPc.values()) if (grp.length > 1 && grp[0].iv.g !== 0 && grp[0].iv.g !== 2 && !(grp[0].iv.g === 5 && present.length === 3))
            push('doubling', grp.map(u => snd[u.v].k), `In bar ${m.b + 1} the ${grp[0].iv.g === 4 ? '5th' : grp[0].iv.g === 5 ? '6th' : 'note'} above the bass is doubled. Fux doubles the octave first, then the 3rd, and the 5th or 6th only rarely.`, 'warn');
        }
      }
      prev = { b: m.b, on: m.on, snd };
    }
    // First and last chords.
    const first = Array.from({ length: V }, (_, v) => { const x = at(v, 0, 0); return x && x.n ? x : at(v, 0, 2) || at(v, 0, 1); });
    const lastS = Array.from({ length: V }, (_, v) => at(v, n - 1, 0));
    const chordCheck = (snd, where, allowThird) => {
      const pres = snd.map((x, v) => x && x.n ? v : -1).filter(v => v >= 0);
      if (pres.length < V) return;
      const low = pres.reduce((a, v) => midi(snd[v].n) < midi(snd[a].n) ? v : a, pres[0]);
      if (!pcSame(snd[low].n, final)) push(where === 'end' ? 'end' : 'start', [snd[low].k], `The ${where === 'end' ? 'last' : 'first'} chord stands on the final, ${noteName(final).replace(/\d+$/, '')}, in the bass. Here the bass has ${noteName(snd[low].n)}.`);
      pres.filter(v => v !== low).forEach(v => {
        const iv = interval(snd[low].n, snd[v].n), ok = iv.perfect || (allowThird && iv.g === 2 && (where !== 'end' || iv.q === 'M'));
        if (!ok) push(where === 'end' ? 'end' : 'start', [snd[v].k], where === 'end' ? `The last chord uses the final, its 5th, or a major 3rd. The ${nm(v)} has ${describe(iv)} above the bass.` : `Begin with the final, its 5th or its 3rd above the bass. The ${nm(v)} has ${describe(iv)}.`);
      });
    };
    chordCheck(first, 'start', true); chordCheck(lastS, 'end', true);
    // Cadence: one voice rises from the leading tone to the final (raised outside Phrygian).
    const pen = Array.from({ length: V }, (_, v) => { let x = null; for (const on of [3.5, 3, 2, 0]) { const y = at(v, n - 2, on); if (y && y.n) { x = y; break; } } return x; });
    if (pen.every(x => x) && lastS.every(x => x && x.n)) {
      let rise = -1, fall = -1;
      for (let v = 0; v < V; v++) { const m = melodic(pen[v].n, lastS[v].n); if (pcSame({ d: lastS[v].n.d, alt: lastS[v].n.alt }, final) && m.step) { if (m.dir > 0) rise = v; else fall = v; } }
      if (rise < 0 && !(phryg && fall >= 0)) push('cadence', pen.map(x => x.k), `End with a cadence: one voice steps up from the leading tone to the final${phryg ? ', or in Phrygian one voice steps down to it' : ''}.`);
      else if (rise >= 0 && !phryg) { const p = pen[rise].n; if (midi(lastS[rise].n) - midi(p) !== 1) push('cadence', [pen[rise].k], `Raise the leading tone: ${noteName(p)} should be ${noteName({ d: p.d, alt: p.alt + 1 })}, a half step below the final.`); }
    }
    // Each written voice as a melody.
    for (let v = 0; v < V; v++) {
      if (v === ex.cv) continue;
      const idx = byVoice[v], line = idx.map(k => cp[k]);
      const [lo, hi] = RANGES[V][v];
      idx.forEach((k, j) => {
        const c = cp[k]; if (!c) return;
        if (midi(c) < lo - 2 || midi(c) > hi + 2) push('range', [k], `${noteName(c)} is outside the ${nm(v)}'s range.`, 'warn');
        const isPen = MS[k].bar === n - 2;
        if (c.alt !== sig[letterOf(c.d)] && !(isPen && c.alt === sig[letterOf(c.d)] + 1)) push('chromatic', [k], `${noteName(c)} is outside the mode. Use chromatic notes only for the raised leading tone at the cadence.`, 'warn');
        const p = j > 0 ? line[j - 1] : null; if (!p) return;
        const mm = melodic(p, c);
        if (mm.ag === 0) push('repeat', [idx[j - 1], k], `Repeated note in the ${nm(v)} (${noteName(c)}). In three or more voices it is allowed now and then, but keep the line moving.`, 'warn');
        else if (!mm.ok) push('melodic', [idx[j - 1], k], `The leap ${noteName(p)} → ${noteName(c)} in the ${nm(v)} is ${mm.ag === 5 && mm.dir < 0 ? 'a descending 6th' : describe(mm.iv)}, which is hard to sing.`);
        if (MS[k].dur === 0.5 && !mm.step) push('eighths', [idx[j - 1], k], `Eighth notes move by step, in and out.`);
      });
      outlines(line, v === ex.fv ? 'line' : 'voice').forEach(o => push('outline', o.cols.map(i => idx[i]), o.msg, 'warn'));
    }
    const filled = cp.filter(Boolean).length, complete = filled === cp.length;
    if (complete && !issues.some(x => x.sev === 'error')) {
      const full = figures.slice(1, -1).filter(f => f && f.some(x => x === 3 || x === 6)).length;
      if (full >= (n - 2) * 0.8) strengths.push({ rule: 'imperfect', cols: [], msg: `${full} of ${n - 2} inner chords have a 3rd or 6th: the harmony sounds full.` });
    }
    const errors = issues.filter(x => x.sev === 'error'), warns = issues.filter(x => x.sev === 'warn');
    return { issues, errors, warns, strengths, figures, complete, filled, shape: complete ? Math.max(20, 100 - 10 * warns.length) : null, slots: MS };
  }
  function candidatesMulti(ex, MS, k) {
    const s = MS[k], [lo, hi] = RANGES[ex.V][s.voice], sig = signature(ex.key), out = [];
    for (let d = 0; d < 70; d++) {
      const c = { d, alt: sig[letterOf(d)] }, m = midi(c);
      if (m < lo || m > hi) continue;
      out.push(c);
      if (s.bar === ex.cf.length - 2 && ex.key.mode !== 'phrygian' && pcSame({ d: d + 1, alt: 0 }, { d: ex.final.d, alt: 0 })) out.push({ d, alt: c.alt + 1 });
    }
    return out.filter(c => Math.abs(c.alt) <= 1);
  }
  function allowedMulti(ex, cp, k) {
    const MS = mslots(ex), out = [];
    for (const c of candidatesMulti(ex, MS, k)) {
      const t = cp.slice(); t[k] = c;
      // The cadence is blamed on the penultimate notes, but the last notes decide it: count it against both bars.
      if (!checkMulti(ex, t).errors.some(e => e.cols.includes(k) || (e.rule === 'cadence' && e.cols.every(x => t[x]) && e.cols.some(x => MS[x].bar + 1 === MS[k].bar)))) out.push(c);
    }
    // Keep only notes that leave this voice finishable: its next notes and its cadence must still have an answer.
    const v = MS[k].voice, sameV = [...MS.keys()].filter(j => MS[j].voice === v), last2 = sameV.slice(-2);
    // The first, penultimate and last chords are judged as a whole, so the other voices of this bar must be able to answer too.
    const nB = ex.cf.length, special = MS[k].bar === 0 || MS[k].bar >= nB - 2, chordMates = special ? [...MS.keys()].filter(j => j !== k && MS[j].voice !== v && (MS[j].bar === MS[k].bar || (MS[k].bar >= nB - 2 && MS[j].bar >= nB - 2))) : [];
    const keep = out.filter(c => {
      const t = cp.slice(); t[k] = c;
      // A chord rule is reported on one voice's note, but every note of that bar can break it.
      const wholeBar = tt => checkMulti(ex, tt).issues.map(e => { const bars = new Set(e.cols.map(c => MS[c].bar)); if (['cadence', 'end'].includes(e.rule)) for (const b of [...bars]) bars.add(b + 1); return Object.assign({}, e, { cols: [...new Set(e.cols.concat([...MS.keys()].filter(c => bars.has(MS[c].bar) && tt[c])))] }); });
      return canContinue(t, k, wholeBar, (tt, j) => {
        let p = null; for (let i = j - 1; i >= 0; i--) if (tt[i] && MS[i].voice === MS[j].voice) { p = tt[i]; break; }
        const list = candidatesMulti(ex, MS, j); return p ? list.slice().sort((a, b) => Math.abs(a.d - p.d) - Math.abs(b.d - p.d)) : list;
      }, 90, 2, last2.concat(chordMates).filter(j => j > k || j !== k));
    });
    return keep.length ? keep : out;
  }
  // Model answer: the first-species voices bar by bar, then the florid voice note by note. Crossings, unisons,
  // repeated notes and hollow chords are avoided as if they were errors; if the florid voice will not fit,
  // the plain voices are written again. The best of a few answers (fewest suggestions) wins.
  const SOFT_HARD = ['crossing', 'unison', 'repeat', 'hollow', 'spacing', 'doubling'];
  function solveMulti(ex, r, limitMs = 1500, firstOnly = false) {
    const MS = mslots(ex), t0 = Date.now(), n = ex.cf.length;
    const plain = MS.map((s, k) => k).filter(k => MS[k].voice !== ex.fv), flor = MS.map((s, k) => k).filter(k => MS[k].voice === ex.fv);
    const bars = Array.from({ length: n }, (_, b) => plain.filter(k => MS[k].bar === b));
    const prevK = MS.map((s, k) => { for (let i = k - 1; i >= 0; i--) if (MS[i].voice === s.voice) return i; return -1; });
    const cand = MS.map((s, k) => candidatesMulti(ex, MS, k));
    let best = null, bestW = 1e9, round = 0;
    const late = () => Date.now() - t0 > limitMs;
    const [flo, fhi] = ex.fv >= 0 ? RANGES[ex.V][ex.fv] : [0, 0];
    while (!late() && bestW > 0 && !(firstOnly && best)) {
      const cp = new Array(MS.length).fill(null);
      round++;
      // Every other round: write the florid voice first, against the cantus alone (the two-voice solver),
      // then fit the plain voices around both.
      if (flor.length && round % 2 === 0) {
        const two = { key: ex.key, cf: ex.cf, above: ex.fv < ex.cv, species: ex.sp, rh: ex.rh, ties: ex.ties, breaks: ex.breaks };
        const line = solveN(two, r, 250);
        if (!line || line.length !== flor.length || line.some(c => midi(c) < flo - 2 || midi(c) > fhi + 2)) continue;
        flor.forEach((k, j) => { cp[k] = line[j]; });
      }
      const bad = (ks, strict) => checkMulti(ex, cp).issues.filter(e => (e.sev === 'error' || (strict === true && SOFT_HARD.includes(e.rule)) || (strict === 'fl' && e.rule === 'crossing')) && e.cols.some(c => ks.includes(c)));
      const order = k => { const p = prevK[k] >= 0 ? cp[prevK[k]] : null; return shuffle(cand[k].slice(), r).filter(c => !p || (Math.abs(c.d - p.d) <= 4 && c.d !== p.d)).sort((a, b) => p ? Math.abs(a.d - p.d) - Math.abs(b.d - p.d) + (r() - 0.5) * 1.5 : 0); };
      let ok = false;
      // With a florid voice still to come, one of the plain voices (or the cantus) takes the cadence itself.
      const lineOf = v => v === ex.cv ? ex.cf : bars.map(ks => cp[ks.find(k => MS[k].voice === v)]);
      const cadOk = () => {
        const phryg = ex.key.mode === 'phrygian';
        for (let v = 0; v < ex.V; v++) {
          if (v === ex.fv) continue;
          const L = lineOf(v), a = L[n - 2], b = L[n - 1]; if (!a || !b) continue;
          const up = midi(b) - midi(a), toFinal = pcSame(b, ex.final);
          if (toFinal && (phryg ? Math.abs(b.d - a.d) === 1 : up === 1)) return true;
        }
        return false;
      };
      const tPlain = Date.now();
      (function dfsBar(b) {
        if (ok || late() || Date.now() - tPlain > limitMs / 3) return;
        if (b === n) { ok = !flor.length || (cp[flor[0]] ? !checkMulti(ex, cp).errors.length : cadOk()); return; }
        const ks = bars[b];
        (function dfsVoice(i) {
          if (ok || late()) return;
          if (i === ks.length) { const pre = flor.length && cp[flor[0]]; if (!bad(pre ? ks.concat(flor.filter(k => MS[k].bar === b)) : ks, true).filter(e => !(e.rule === 'cadence' && flor.length && !pre)).length) dfsBar(b + 1); return; }
          for (const c of order(ks[i])) {
            cp[ks[i]] = c;
            if (!bad(ks.slice(0, i + 1), false).filter(e => !['cadence', 'end', 'start'].includes(e.rule)).length) dfsVoice(i + 1);
            if (ok) return;
          }
          cp[ks[i]] = null;
        })(0);
      })(0);
      if (!ok) continue;
      let done = (!flor.length || cp[flor[0]]) && !checkMulti(ex, cp).errors.length;
      const tFl = Date.now();
      if (flor.length && !cp[flor[0]]) (function dfs(j) {
        if (done || late() || Date.now() - tFl > limitMs / 3) return;
        if (j === flor.length) { done = !checkMulti(ex, cp).errors.length; return; }
        const k = flor[j];
        for (const c of order(k)) {
          cp[k] = c;
          const win = flor.slice(Math.max(0, j - 1), j + 1);
          if (!bad(win, ex.V === 4 ? 'fl' : true).filter(e => e.cols.every(x => !flor.includes(x) || flor.indexOf(x) <= j)).length) dfs(j + 1);
          if (done) return;
        }
        cp[k] = null;
      })(0);
      if (!done) continue;
      const w = checkMulti(ex, cp).warns.length;
      if (w < bestW) { best = cp.slice(); bestW = w; }
    }
    return best;
  }
  function newMultiExercise({ mode, voices = 3, cv = null, species = 1, seed, len: fixedLen, fv = null, fux = false }) {
    const r = rng(seed || Date.now()), modes = mode && mode !== 'any' ? [mode] : Object.keys(MODES), tries = {};
    const t0 = Date.now();
    for (let attempt = 0; attempt < 14 && Date.now() - t0 < (voices === 4 && species > 1 ? 9000 : 6000); attempt++) {
      if (!modes.length) break;
      const m = modes[Math.floor(r() * modes.length)], V = voices, c = cv == null ? Math.floor(r() * V) : cv, [lo, hi] = RANGES[V][c];
      let key, cf, final;
      if (fux) {
        if ((tries[m] = (tries[m] || 0) + 1) > 2) { modes.splice(modes.indexOf(m), 1); attempt--; continue; }
        ({ key, cf, final } = fuxCantus(m, lo + 3, lo + 14));
        if (cf.some(n => midi(n) < lo || midi(n) > hi)) ({ key, cf, final } = fuxCantus(m, lo, lo + 11));
        if (cf.some(n => midi(n) < lo || midi(n) > hi)) continue;
      } else {
        key = keysFor(m)[Math.floor(r() * keysFor(m).length)];
        final = tonicNote(key, lo + 3, lo + 14);
        cf = makeCantus(key, fixedLen || 8 + Math.floor(r() * 3), final, r);
      }
      if (!cf) continue;
      const len = cf.length;
      const tf = c === V - 1 ? final : tonicNote(key, RANGES[V][V - 1][0] + 3, RANGES[V][V - 1][0] + 14);
      const ex = { kind: 'multi', key, cf, V, cv: c, sp: species, fv: -1, final: tf, id: 'mv' + Math.floor(r() * 1e9).toString(36) };
      if (fux) ex.fux = m;
      if (species > 1) {
        ex.fv = fv != null && fv !== c ? fv : (c === 0 ? 1 : 0);
        if (species === 5) Object.assign(ex, florid(len, r));
        delete ex.species;
      }
      const sol = solveMulti(ex, r, species >= 3 ? 1200 : 900, true);
      if (sol) { ex.sol = sol; return ex; }
    }
    return null;
  }

  // ---------------- Analysis of finished work ----------------
  // A short, honest reading of a complete line: a grade, a few plain sentences, the numbers behind them and the points to polish.
  function analyse(ex, cp, res) {
    if (!res || !res.complete) return null;
    const nE = res.errors.length;
    // Each kind of suggestion has a weight: 3 for the main rules of the style, 2 for solid craft, 1 for polish.
    // The grade comes from the total weight, and a main point never grades above Fair.
    const wOf = r => (r in WEIGHT ? WEIGHT[r] : 1);
    const kinds = [...new Set(res.warns.map(w => w.rule))].filter(r => wOf(r) > 0);
    const total = kinds.reduce((a, r) => a + wOf(r), 0), main = kinds.filter(r => wOf(r) >= 3);
    let grade = nE ? 'fix' : total === 0 ? 'excellent' : total <= 3 ? 'good' : total <= 7 ? 'fair' : 'rough';
    if (!nE && main.length && (grade === 'excellent' || grade === 'good')) grade = 'fair';
    const isC = ex.kind === 'cantus';
    const title = { fix: 'Fix the rule errors first', excellent: 'Excellent work', good: isC ? 'A good cantus' : 'Good counterpoint', fair: 'Sound, with room to grow', rough: 'Correct, but still rough' }[grade];
    const stats = [], sentences = [];
    const ord = n => ({ 1: 'unison', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'octave', 9: '9th', 10: '10th', 11: '11th', 12: '12th' }[n] || n + 'th');
    const multi = ex.kind === 'multi', cantus = ex.kind === 'cantus';
    const S = multi ? null : ((ex.species || 1) > 1 && !cantus ? slotsN(ex) : null);
    if (!multi) {
      // The line itself.
      const idx = []; cp.forEach((c, i) => { if (c) idx.push(i); });
      const line = idx.map(i => cp[i]); let steps = 0, leaps = 0, reps = 0, big = 0, bigOk = 0;
      for (let k = 1; k < line.length; k++) {
        const m = melodic(line[k - 1], line[k]);
        if (m.step) steps++; else if (m.ag === 0) reps++; else { leaps++; if (m.bigLeap) { big++; const nx = k + 1 < line.length ? melodic(line[k], line[k + 1]) : null; if (!nx || (nx.step && nx.dir === -m.dir)) bigOk++; } }
      }
      const moves = line.length - 1;
      if (moves > 0) {
        const pct = Math.round(100 * steps / moves);
        stats.push(['Steps', pct + '%'], ['Leaps', String(leaps)]);
        sentences.push(`Your line moves by step ${pct}% of the time, with ${leaps === 0 ? 'no leaps' : leaps === 1 ? 'one leap' : leaps + ' leaps'}${big ? (bigOk === big ? ', each large one answered by a step back' : bigOk === 0 ? `, and ${big === 1 ? 'the large one is' : 'the large ones are'} not answered by a step back` : `, but only ${bigOk} of ${big} large leaps are answered by a step back`) : ''}.`);
      }
      const hi = ex.above || cantus ? Math.max(...line.map(midi)) : Math.min(...line.map(midi));
      const peakI = idx.filter(i => midi(cp[i]) === hi), top = cp[peakI[0]];
      const bar = i => (S ? S[i].bar : i) + 1;
      const lo = Math.min(...line.map(x => x.d)), up = Math.max(...line.map(x => x.d));
      stats.push(['Range', (/^(octave|11th)/.test(ord(up - lo + 1)) ? 'an ' : 'a ') + ord(up - lo + 1)]);
      sentences.push(`The ${ex.above || cantus ? 'highest' : 'lowest'} note, ${noteName(top)}, ${peakI.length === 1 ? 'comes once, in bar ' + bar(peakI[0]) : 'returns ' + peakI.length + ' times, first in bar ' + bar(peakI[0])}, and the line spans ${/^(octave|11th)/.test(ord(up - lo + 1)) ? 'an ' : 'a '}${ord(up - lo + 1)}.`);
      // Against the cantus.
      if (!cantus) {
        let imp = 0, perf = 0, tot = 0, con = 0, obl = 0, sim = 0, pm = null;
        idx.forEach(i => {
          const sl = S ? S[i] : { bar: i, strong: true }; if (!sl.strong) return;
          const v = ivLH(ex.cf[sl.bar], cp[i]); tot++;
          if (v.g === 2 || v.g === 5) imp++; else if (v.g === 0 || (v.g === 4 && v.q === 'P')) perf++;
          const cur = { cf: ex.cf[sl.bar], cp: cp[i] };
          if (pm) { const a = Math.sign(cur.cf.d - pm.cf.d), b = Math.sign(cur.cp.d - pm.cp.d); if (a === 0 && b === 0) {} else if (a === 0 || b === 0) obl++; else if (a === b) sim++; else con++; }
          pm = cur;
        });
        if (tot >= 3) {
          stats.push(['3rds and 6ths', `${imp} of ${tot}`], ['Contrary motion', String(con)]);
          sentences.push(`On the downbeats, ${imp} of ${tot} intervals are 3rds or 6ths and ${perf} are perfect. The voices move in contrary motion ${con} ${con === 1 ? 'time' : 'times'}, obliquely ${obl} and in similar motion ${sim}.`);
        }
        if ((ex.species || 1) === 5 && ex.rh) stats.push(['Rhythms used', String(new Set(ex.rh).size)]);
      }
    } else {
      stats.push(['Voices', String(ex.V)], ['Bars', String(ex.cf ? ex.cf.length : 0)]);
      const full = res.strengths.find(x => x.rule === 'imperfect');
      sentences.push(`Every voice is checked against every other, and the chords were heard from the bass.${full ? ' ' + full.msg : ''}`);
    }
    // Good points and points to polish.
    const done = res.strengths.filter(x => x.rule !== 'imperfect' || !multi).slice(0, 3).map(x => x.msg);
    const seen = new Set(), polish = [];
    for (const w of res.warns.slice().sort((a, b) => wOf(b.rule) - wOf(a.rule))) if (!seen.has(w.rule) && TIPS[w.rule] && wOf(w.rule) > 0) { seen.add(w.rule); polish.push('It would be better to ' + TIPS[w.rule] + '.'); }
    const verdict = grade === 'excellent' ? 'Nothing to correct and nothing weak: a line you could hand in.' : grade === 'good' ? 'No rule errors, and only a couple of small points to polish.' : grade === 'fair' ? (main.length ? `No rule errors, but one main point needs work: ${TIPS[main[0]] || main[0]}.` : 'No rule errors. Work through the suggestions to make it more musical.') : grade === 'rough' ? 'No rule errors, but several things hold the line back.' : `${nE} rule ${nE === 1 ? 'error' : 'errors'} to correct before the style points matter.`;
    return { grade, title, verdict, sentences, stats, done, polish: polish.slice(0, 4) };
  }

  return { analyse, TIPS, RANGES, VOICE_NAMES, mslots, checkMulti, allowedMulti, solveMulti, newMultiExercise, florid, FUX, fuxCantus, checkCantus, allowedCantus, solveCantus, newCantusExercise, RHYTHMS, ALL_RHYTHMS, rhythmOf, idOf, parseRhythm, slotsN, checkN, allowedN, solveN, slots2, check2, allowed2, solve2, allowed, MODES, LETTERS, midi, noteName, pitchClassName, signature, keysFor, keyName, interval, describe, melodic, check, localErrors, solve, newExercise, letterOf, rng, tonicNote };
})();
if (typeof module !== 'undefined') module.exports = Gradus;
