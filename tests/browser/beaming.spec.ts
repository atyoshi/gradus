import { expect, test } from "@playwright/test";

test("adjacent eighth notes beam by beat and update after editing", async ({ page }) => {
  const fixture = {
    version: 1, id: "beam-fixture", title: "Beam fixture", species: 5, mode: "Dorian", bars: 1,
    voices: [
      { id: "top", name: "Counterpoint", locked: false, species: 5, notes: [0, 1, 2, 3].map((time) => ({ id: `top${time}`, time, duration: 1, pitch: { step: "C", alter: 0, octave: 5 } })).concat([{ id: "tail", time: 4, duration: 4, pitch: { step: "D", alter: 0, octave: 5 } }]) },
      { id: "cf", name: "Cantus", locked: true, notes: [{ id: "cf0", time: 0, duration: 8, pitch: { step: "D", alter: 0, octave: 4 } }] },
    ],
  };
  await page.addInitScript((s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)), fixture);
  await page.goto("/");
  await expect(page.locator(".engraving .vf-beam")).toHaveCount(2);
  for (const id of ["top0", "top1", "top2", "top3"]) await expect(page.locator(`[id="vf-score-note-${id}"] .vf-flag`)).toHaveCount(0);
  await page.locator('[data-note="top3"]').focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Backspace");
  await expect(page.locator(".engraving .vf-beam")).toHaveCount(1);
  await expect(page.locator('[id="vf-score-note-top2"] .vf-flag')).toHaveCount(1);
});
