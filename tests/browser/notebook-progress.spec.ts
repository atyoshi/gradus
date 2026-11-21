import { expect, test } from "@playwright/test";

test("notebook progress counts written editable notes and rests, not the given voice", async ({ page, request }) => {
  const score = {
    version: 1, id: "notebook-progress-fixture", title: "Notebook progress fixture",
    species: 1, mode: "Dorian", bars: 3,
    voices: [
      { id: "cp", name: "Counterpoint", locked: false, species: 1, notes: [
        { id: "cp1", time: 0, duration: 8, pitch: { step: "A", octave: 4, alter: 0 } },
        { id: "cp2", time: 8, duration: 8, rest: true },
        { id: "cp3", time: 16, duration: 8 },
      ] },
      { id: "cf", name: "Cantus", locked: true, species: 1, notes: [0, 8, 16].map((time, i) => ({
        id: `cf${i}`, time, duration: 8, pitch: { step: "D", octave: 4, alter: 0 },
      })) },
    ],
  };
  expect((await request.post("/api/library", { data: score })).ok()).toBeTruthy();
  await page.goto("/");
  await page.getByRole("button", { name: /Your notebook/ }).click();
  const card = page.getByRole("button", { name: /Notebook progress fixture/ });
  await expect(card).toContainText("2 notes written");
});
