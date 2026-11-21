import { afterEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({ samplers: [] as any[] }));
vi.mock("tone", () => ({
  start: vi.fn(async () => {}),
  now: () => 10,
  Frequency: (value: number) => ({ toNote: () => `midi:${value}` }),
  Sampler: class {
    volume = { value: 0 };
    dispose = vi.fn();
    releaseAll = vi.fn();
    triggerAttackRelease = vi.fn();
    constructor(public options: any) {
      audio.samplers.push(this);
    }
    toDestination() {
      return this;
    }
  },
}));
import { play, previewPitch, stop } from "../src/audio";
import type { Score } from "../src/model";
const c = { step: "C", alter: 0, octave: 4 };
afterEach(() => {
  stop();
  audio.samplers.length = 0;
});

describe("note entry audio", () => {
  it("uses the selected instrument, reuses samples, and plays the exact accidental", async () => {
    const first = previewPitch(c, "cello");
    await Promise.resolve();
    const sampler = audio.samplers[0];
    expect(sampler.options.baseUrl).toBe("/audio/cello/");
    sampler.options.onload();
    await first;
    await previewPitch({ ...c, alter: 1 }, "cello");
    expect(audio.samplers).toHaveLength(1);
    expect(sampler.triggerAttackRelease).toHaveBeenLastCalledWith(
      "midi:61",
      0.3,
      10,
    );
  });

  it("only auditions the latest note if entry outruns sample loading", async () => {
    const first = previewPitch(c);
    await Promise.resolve();
    const second = previewPitch({ ...c, octave: 5 });
    await Promise.resolve();
    const sampler = audio.samplers[0];
    sampler.options.onload();
    await Promise.all([first, second]);
    expect(sampler.triggerAttackRelease).toHaveBeenCalledExactlyOnceWith(
      "midi:72",
      0.3,
      10,
    );
  });

  it("cancels pending previews when stopped and reloads after a load error", async () => {
    const pending = previewPitch(c);
    await Promise.resolve();
    const sampler = audio.samplers[0];
    stop();
    sampler.options.onload();
    await pending;
    expect(sampler.dispose).toHaveBeenCalled();
    expect(sampler.triggerAttackRelease).not.toHaveBeenCalled();
    const failed = previewPitch(c);
    await Promise.resolve();
    const rejection = expect(failed).rejects.toThrow("missing sample");
    audio.samplers[1].options.onerror(new Error("missing sample"));
    await rejection;
    const retry = previewPitch(c);
    await Promise.resolve();
    audio.samplers[2].options.onload();
    await retry;
    expect(audio.samplers[2].triggerAttackRelease).toHaveBeenCalledOnce();
  });

  it("does not stop an ongoing score when auditioning an edit", async () => {
    const score = {
      voices: [{ id: "v1", notes: [{ pitch: c, time: 0, duration: 8 }] }],
    } as Score;
    const onStop = vi.fn();
    const playback = play(score, 88, [], 0, 8, false, vi.fn(), onStop);
    await Promise.resolve();
    const playbackSamplers = [...audio.samplers];
    playbackSamplers.forEach((s) => s.options.onload());
    await playback;
    const entry = previewPitch(c, "violin");
    await Promise.resolve();
    audio.samplers.at(-1).options.onload();
    await entry;
    expect(
      playbackSamplers.every((s) => s.dispose.mock.calls.length === 0),
    ).toBe(true);
    expect(onStop).not.toHaveBeenCalled();
  });
});
