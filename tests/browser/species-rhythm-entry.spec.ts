import { test, expect, type Page } from "@playwright/test";
import { emptyPattern } from "../../src/editor";
import { pitch, type Score } from "../../src/model";

const draft = (page: Page): Promise<Score> => page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")!));
for (const [species, enabled] of [[1, [8]], [2, [4]], [3, [2]], [4, [4, 8]]] as const) {
  test(`species ${species} disables invalid durations for buttons, menu and keyboard`, async ({ page }) => {
    const score: Score = {
      version: 1, id: `rhythm-browser-${species}`, title: "Rhythm", species, mode: "Dorian", bars: 5,
      voices: [
        { id: "cp", name: "Counterpoint", locked: false, species, notes: emptyPattern("cp", 5, species) },
        { id: "cf", name: "Cantus", locked: true, species: 1, notes: emptyPattern("cf", 5, 1).map((n) => ({ ...n, pitch: pitch(28) })) },
      ],
    };
    await page.addInitScript((s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
    await page.goto("/");
    const slot = page.locator('[data-note="cpn8"]');
    await slot.focus();
    await slot.press("Enter");
    const values = [[8, "Whole", "7"], [4, "Half", "6"], [2, "Quarter", "5"], [1, "Eighth", "4"]] as const;
    for (const [duration, name] of values) {
      const button = page.getByRole("button", { name: new RegExp(`^${name} note`) });
      if (enabled.includes(duration as never)) await expect(button).toBeEnabled();
      else await expect(button).toBeDisabled();
      const option = page.getByLabel("Note duration", { exact: true }).locator(`option[value="${duration}"]`);
      if (enabled.includes(duration as never)) await expect(option).toBeEnabled();
      else await expect(option).toBeDisabled();
    }
    for (const duration of [3, 6])
      await expect(page.getByLabel("Note duration", { exact: true }).locator(`option[value="${duration}"]`)).toBeDisabled();
    const before = await draft(page);
    const invalid = values.find(([duration]) => !enabled.includes(duration as never))!;
    await page.keyboard.press(invalid[2]);
    expect(await draft(page)).toEqual(before);
    await page.keyboard.press("a");
    const after = await draft(page);
    expect(after.voices[0].notes.map((n) => [n.id, n.time, n.duration])).toEqual(before.voices[0].notes.map((n) => [n.id, n.time, n.duration]));
    expect(after.voices[1]).toEqual(before.voices[1]);
  });
}
