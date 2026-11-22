import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { parseKern, type Score } from "../../src/model";
import { pathStudy } from "../../src/path";

const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
const draft = (page: Page): Promise<Score> => page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")!));

for (const figure of [121, 122]) test(`Figure ${figure} note entry does not create a tie; an explicit tie still works`, async ({ page }) => {
  const source = parseKern(rows.find((row: any) => row.metadata.id === `gap_${figure}`));
  const fixture = pathStudy(source, [], null);
  await page.addInitScript((score) => {
    if (!sessionStorage.getItem("second-species-seeded")) {
      localStorage.setItem("gradus-recovery", JSON.stringify(score));
      sessionStorage.setItem("second-species-seeded", "true");
    }
  }, fixture);
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  const voice = fixture.voices.find((v) => !v.locked && v.species === 2)!;
  const first = voice.notes.find((n) => n.time === 68)!;
  const second = voice.notes.find((n) => n.time === 72)!;
  const slot = page.locator(`[data-note="${first.id}"]`);
  await slot.focus();
  await slot.press("Enter");
  const before = await draft(page);
  await page.keyboard.press("a");
  const entered = await draft(page);
  const pair = entered.voices.find((v) => v.id === voice.id)!.notes.filter((n) => n.id === first.id || n.id === second.id);
  expect(pair[0].pitch).not.toBeNull();
  expect(pair[0].tieStart).toBeFalsy();
  expect(pair[1]).toEqual(before.voices.find((v) => v.id === voice.id)!.notes.find((n) => n.id === second.id));
  await expect(page.locator(".vf-stavetie")).toHaveCount(0);
  await page.getByTitle("Undo", { exact: true }).click();
  expect(await draft(page)).toEqual(before);
  await page.getByTitle("Redo", { exact: true }).click();
  expect(await draft(page)).toEqual(entered);
  await slot.focus();
  await slot.press("Enter");
  await page.getByRole("button", { name: "Add tie", exact: true }).click();
  const tied = await draft(page);
  const tiedNotes = tied.voices.find((v) => v.id === voice.id)!.notes;
  expect(tiedNotes.find((n) => n.id === first.id)?.tieStart).toBe(true);
  expect(tiedNotes.find((n) => n.id === second.id)?.tieStop).toBe(true);
  await expect(page.locator(".vf-stavetie")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".vf-stavetie")).toHaveCount(1);
  expect(await draft(page)).toEqual(tied);
});
