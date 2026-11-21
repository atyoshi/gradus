import * as Tone from "tone";
import { type Pitch, type Score, midi } from "./model";
let timer: ReturnType<typeof setTimeout> | undefined;
let playing = false;
let generation = 0;
const samplers = new Map<string, Tone.Sampler[]>();
let preview:
  | { instrument: string; sampler: Tone.Sampler; ready: Promise<void> }
  | undefined;
let previewGeneration = 0;
const keys: Record<string, string[]> = {
  piano: ["C3", "C4", "C5"],
  cello: ["C2", "C3", "C4"],
  violin: ["G3", "C4", "C5"],
};
export function stop() {
  previewGeneration++;
  preview?.sampler.dispose();
  preview = undefined;
  generation++;
  playing = false;
  clearTimeout(timer);
  samplers.forEach((xs) => xs.forEach((s) => s.dispose()));
  samplers.clear();
}
/** Audition just the entered pitch, independently of score playback. */
export async function previewPitch(pitch: Pitch, instrument = "piano") {
  const token = ++previewGeneration;
  await Tone.start();
  if (token !== previewGeneration) return;
  if (preview?.instrument !== instrument) {
    preview?.sampler.dispose();
    preview = undefined;
    let sampler!: Tone.Sampler;
    const ready = new Promise<void>((resolve, reject) => {
      sampler = new Tone.Sampler({
        urls: Object.fromEntries(keys[instrument].map((n) => [n, n + ".mp3"])),
        baseUrl: `/audio/${instrument}/`,
        release: 0.15,
        onload: resolve,
        onerror: reject,
      }).toDestination();
      sampler.volume.value = -12;
    });
    preview = { instrument, sampler, ready };
  }
  const current = preview;
  try {
    await current.ready;
  } catch (error) {
    if (preview === current) {
      current.sampler.dispose();
      preview = undefined;
    }
    throw error;
  }
  if (token !== previewGeneration || preview !== current) return;
  const now = Tone.now();
  current.sampler.releaseAll(now);
  current.sampler.triggerAttackRelease(
    Tone.Frequency(midi(pitch), "midi").toNote(),
    0.3,
    now,
  );
}
export async function play(
  score: Score,
  tempo: number,
  muted: string[],
  from: number,
  to: number,
  loop: boolean,
  onTick: (t: number) => void,
  onStop: () => void,
  instrument = "piano",
) {
  stop();
  const token = generation;
  await Tone.start();
  if (!samplers.has(instrument)) {
    const xs = await Promise.all(
      Array.from(
        { length: 4 },
        () =>
          new Promise<Tone.Sampler>((resolve, reject) => {
            const sampler = new Tone.Sampler({
              urls: Object.fromEntries(
                keys[instrument].map((n) => [n, n + ".mp3"]),
              ),
              baseUrl: `/audio/${instrument}/`,
              release: 0.3,
              onload: () => resolve(sampler),
              onerror: reject,
            }).toDestination();
            sampler.volume.value = -12;
          }),
      ),
    );
    if (token !== generation) {
      xs.forEach((s) => s.dispose());
      return;
    }
    samplers.set(instrument, xs);
  }
  if (token !== generation) return;
  playing = true;
  const xs = samplers.get(instrument)!;
  const unit = 30 / tempo;
  function schedule() {
    if (!playing || token !== generation) return;
    const start = Tone.now() + 0.08;
    const length = (to - from) * unit;
    score.voices.forEach((v, vi) => {
      if (muted.includes(v.id)) return;
      for (const n of v.notes) {
        if (!n.pitch || n.rest || n.time < from || n.time >= to) continue;
        if (n.tieStop && n.time > from) continue;
        let duration = n.duration,
          index = v.notes.indexOf(n);
        while (v.notes[index]?.tieStart && v.notes[index + 1]?.tieStop) {
          index++;
          duration += v.notes[index].duration;
        }
        duration = Math.min(duration, to - n.time);
        xs[vi].triggerAttackRelease(
          Tone.Frequency(midi(n.pitch), "midi").toNote(),
          Math.max(0.03, duration * unit - 0.03),
          start + (n.time - from) * unit,
        );
      }
    });
    const tick = () => {
      if (!playing || token !== generation) return;
      const elapsed = Tone.now() - start;
      if (elapsed >= length) {
        if (loop) schedule();
        else {
          playing = false;
          onStop();
        }
        return;
      }
      onTick(from + Math.max(0, elapsed) / unit);
      timer = setTimeout(tick, 40);
    };
    tick();
  }
  schedule();
}
