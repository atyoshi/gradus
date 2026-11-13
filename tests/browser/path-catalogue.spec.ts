import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { parseKern } from "../../src/model";

test("the path exposes historical exercises in every mode and opens the selected study", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.getByRole("button", { name: /The path/ }).click();
  for (const mode of [
    "Dorian",
    "Phrygian",
    "Lydian",
    "Mixolydian",
    "Aeolian",
    "Ionian",
  ]) {
    await page.getByLabel("Path mode").selectOption(mode);
    const studies = page.locator(".path-stage .exercise");
    expect(await studies.count()).toBeGreaterThan(0);
    for (const label of await studies.locator("small").allTextContents()) {
      expect(label).toContain(mode);
    }
    expect(
      await studies.filter({ hasText: "Historical source" }).count(),
    ).toBeGreaterThan(0);
  }
  // Open the species containing the first available Ionian source.
  const source = page
    .locator(".path-stage .exercise")
    .filter({ hasText: "Historical source" })
    .first();
  const parent = source.locator("xpath=ancestor::details");
  if ((await parent.getAttribute("open")) === null)
    await parent.locator("summary").click();
  const title = await source.locator("h3").innerText();
  await source.click();
  await expect(
    page.getByRole("heading", { name: title, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".engraving svg")).toBeVisible();
});

test("a historical printing note is optional reading and permits the next exercise", async ({
  page,
}) => {
  const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
  const score = parseKern(rows.find((r: any) => r.metadata.id === "gap_055"));
  score.path = {
    studyId: score.id,
    species: score.species,
    voices: score.voices.length,
    mode: score.mode,
  };
  score.id = "path-" + score.id;
  await page.addInitScript((score) => {
    localStorage.setItem("gradus-recovery", JSON.stringify(score));
  }, score);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Practice checks passed.", exact: true }),
  ).toBeVisible();
  const note = page.getByRole("region", { name: "Historical notes" });
  await expect(note.getByText("Did you know?", { exact: true })).toBeVisible();
  await note.locator("summary").click();
  await expect(note).toContainText("not a mistake in your notes");
  await expect(page.locator("body")).not.toContainText("source.systems");
  await expect(page.locator("#feedback-context")).toHaveCount(0);
  const next = page.getByRole("button", {
    name: "Next exercise →",
    exact: true,
  });
  await expect(next).toBeVisible();
  await page.screenshot({
    path: "test-results/historical-note.png",
    fullPage: true,
  });
  await next.click();
  await expect(
    page.getByRole("heading", { name: score.title, exact: true, level: 1 }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("gradus-recovery")!).path?.studyId,
      ),
    )
    .not.toBe("gap_055");
});
