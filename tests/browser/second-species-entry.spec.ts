import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { parseKern, type Score } from "../../src/model";
import { pathStudy } from "../../src/path";

const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
const draft = (page: Page): Promise<Score> => page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")!));

for (const [figure, time] of [[121, 68], [122, 68], [123, 68], [126, 60], [127, 76], [128, 76]]) test(`Figure ${figure} resumes and edits a legacy draft without second-species ties`, async ({ page }) => {
  const source = parseKern(rows.find((row: any) => row.metadata.id === `gap_${figure}`));
  const fixture = pathStudy(source, [], null);
  const sourceVoice = source.voices.find((v) => !v.locked && v.species === 2 && v.notes.some((n) => n.time === time && n.tieStart))!;
  const voice = fixture.voices.find((v) => v.id === sourceVoice.id)!;
  const first = voice.notes.find((n) => n.time === time)!;
  const second = voice.notes.find((n) => n.time === time + first.duration)!;
  first.tieStart = second.tieStop = true;
  first.pitch = second.pitch = { step: "F", octave: 3, alter: 0 };
  await page.addInitScript((score) => {
    if (!sessionStorage.getItem("second-species-seeded")) {
      localStorage.setItem("gradus-recovery", JSON.stringify(score));
      sessionStorage.setItem("second-species-seeded", "true");
    }
  }, fixture);
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await expect(page.locator(".vf-stavetie")).toHaveCount(0);
  const slot = page.locator(`[data-note="${first.id}"]`);
  await slot.focus();
  await slot.press("Enter");
  const before = await draft(page);
  await page.keyboard.press("a");
  const entered = await draft(page);
  const pair = entered.voices.find((v) => v.id === voice.id)!.notes.filter((n) => n.id === first.id || n.id === second.id);
  expect(pair[0].pitch).not.toEqual(first.pitch);
  expect(pair[0].tieStart).toBeFalsy();
  expect(pair[1]).toEqual(before.voices.find((v) => v.id === voice.id)!.notes.find((n) => n.id === second.id));
  await expect(page.locator(".vf-stavetie")).toHaveCount(0);
  await page.getByTitle("Undo", { exact: true }).click();
  expect(await draft(page)).toEqual(before);
  await page.getByTitle("Redo", { exact: true }).click();
  expect(await draft(page)).toEqual(entered);
  await slot.focus();
  await slot.press("Enter");
  await expect(page.getByRole("button", { name: /^(Add|Remove) tie$/ })).toHaveCount(0);
  await page.keyboard.press("t");
  expect(await draft(page)).toEqual(entered);
  await page.reload();
  await expect(page.locator(".engraving svg")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".vf-stavetie")).toHaveCount(0);
  expect(await draft(page)).toEqual(entered);
  await page.getByRole("button", { name: "Sample answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Return to my work", exact: true })).toBeVisible();
  await expect(page.locator(".vf-stavetie").first()).toBeVisible();
  await expect(page.getByText(/Fux’s fuller second-species cadences/)).toBeVisible();
  await page.getByRole("button", { name: "Return to my work", exact: true }).click();
  await expect(page.locator(".vf-stavetie")).toHaveCount(0);
  expect(await draft(page)).toEqual(entered);
});
