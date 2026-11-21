import { describe, expect, it } from "vitest";
import { eighthBeamGroups } from "../src/notation";
import type { Note } from "../src/model";

const n = (time: number, duration = 1, pitch: Note["pitch"] = { step: "C", octave: 4, alter: 0 }, rest = false): Note => ({ id: String(time), time, duration, pitch, rest });

describe("eighth note beam groups", () => {
  it("beams adjacent written eighths within each quarter-note beat", () => {
    expect(eighthBeamGroups([n(0), n(1), n(2), n(3), n(4, 2)])).toEqual([[0, 1], [2, 3]]);
  });
  it("does not beam across a beat or measure, rests, gaps, or empty slots", () => {
    expect(eighthBeamGroups([n(1), n(2), n(3, 1, null), n(4), n(5, 1, null, true), n(6), n(8)])).toEqual([]);
  });
});
