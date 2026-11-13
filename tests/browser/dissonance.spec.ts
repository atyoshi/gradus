import { test, expect } from "@playwright/test";
import type { Score } from "../../src/model";

for (const scenario of ["downbeat fourth", "weak-half leap"]) {
  test(`${scenario} turns both notes red with the next slot blank`, async ({
    page,
  }) => {
    const draft: Score = {
      version: 1,
      id: "downbeat-fourth",
      title: "Downbeat fourth",
      species: 2,
      mode: "Dorian",
      bars: 4,
      clefs: ["treble", "treble", "bass"],
      voices: [
        {
          id: "top",
          name: "Voice 1",
          locked: false,
          notes: Array.from({ length: 8 }, (_, i) => ({
            id: `top${i}`,
            time: i * 4,
            duration: 4,
            pitch:
              i < 3
                ? {
                    step: ["F", "E", "D"][i] as "F" | "E" | "D",
                    octave: 5,
                    alter: 0,
                  }
                : null,
          })),
        },
        {
          id: "cantus",
          name: "Cantus",
          locked: true,
          notes: Array.from({ length: 4 }, (_, i) => ({
            id: `cantus${i}`,
            time: i * 8,
            duration: 8,
            pitch: {
              step: i === 1 ? ("F" as const) : ("D" as const),
              octave: 4,
              alter: 0,
            },
          })),
        },
        {
          id: "bass",
          name: "Voice 3",
          locked: false,
          notes: Array.from({ length: 4 }, (_, i) => ({
            id: `bass${i}`,
            time: i * 8,
            duration: 8,
            pitch:
              i < 2
                ? {
                    step: i === 0 ? ("D" as const) : ("A" as const),
                    octave: i === 0 ? 3 : 2,
                    alter: 0,
                  }
                : null,
          })),
        },
      ],
    };
    if (scenario === "weak-half leap") {
      draft.voices[0].notes.forEach((n) => {
        n.pitch = null;
      });
      draft.voices[0].notes[0].pitch = { step: "G", octave: 4, alter: 0 };
      draft.voices[0].notes[1].pitch = { step: "D", octave: 5, alter: 0 };
      draft.voices[1].notes[0].pitch = { step: "C", octave: 4, alter: 0 };
      draft.voices[2].notes[0].pitch = { step: "C", octave: 3, alter: 0 };
    }
    await page.addInitScript(
      (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
      draft,
    );
    await page.goto("/");
    for (const id of scenario === "weak-half leap"
      ? ["top1", "bass0"]
      : ["top2", "bass1"]) {
      const note = page.locator(`[id="vf-score-note-${id}"] .vf-notehead`);
      await expect(note).toBeVisible();
      await expect
        .poll(() => note.evaluate((e) => getComputedStyle(e).fill))
        .toBe(
          await page.locator(".engraving").evaluate((e) => {
            const probe = document.createElement("span");
            probe.style.color = "var(--error)";
            e.append(probe);
            const color = getComputedStyle(probe).color;
            probe.remove();
            return color;
          }),
        );
    }
  });
}
