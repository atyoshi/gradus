import { expect, test } from "vitest";
import { VexFlow } from "vexflow/bravura";
import { engravedNote } from "../src/notation";
import { pitch } from "../src/model";
import { intervalName } from "../src/analysis";

VexFlow.setFonts("Bravura", "Academico");

test.each(["treble", "bass", "alto", "tenor"])(
  "rests sit on standard staff lines in %s clef",
  (clef) => {
    for (const degree of [7, 22, 40]) {
      expect(
        engravedNote(pitch(degree), 8, clef, true).getKeyProps()[0].line,
      ).toBe(4);
      expect(
        engravedNote(pitch(degree), 4, clef, true).getKeyProps()[0].line,
      ).toBe(3);
    }
  },
);

test.each([
  [1, "unison"],
  [8, "octave"],
  [11, "11th"],
  [12, "12th"],
  [13, "13th"],
  [21, "21st"],
  [22, "22nd"],
  [23, "23rd"],
  [24, "24th"],
])("interval %s has the label %s", (n, expected) => {
  expect(intervalName(Number(n))).toBe(expected);
});
