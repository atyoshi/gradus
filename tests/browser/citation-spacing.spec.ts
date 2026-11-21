import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { blank, parseKern } from "../../src/model";

test("finding citations and lesson links are visibly separated", async ({ page }) => {
  const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
  const score = blank(parseKern(rows.find((row: any) => row.metadata.id === "gap_005")));
  await page.addInitScript((s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
  await page.setViewportSize({ width: 1512, height: 1100 });
  await page.goto("/");
  const first = page.locator('[data-note="v1n0"]');
  await first.focus();
  await first.press("Enter");
  await page.keyboard.press("e");
  const details = page.locator(".finding-reference").filter({ has: page.locator(".finding-lesson") }).first();
  await details.locator("summary").click();
  for (const width of [1512, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    const spacing = await details.locator(".finding-lesson").evaluate((button) => {
      const citation = button.parentElement!.querySelector("a")!.getBoundingClientRect();
      const lesson = button.getBoundingClientRect();
      return { sameLine: lesson.top < citation.bottom && citation.top < lesson.bottom, horizontal: lesson.left - citation.right, vertical: lesson.top - citation.bottom };
    });
    expect(spacing.sameLine ? spacing.horizontal : spacing.vertical).toBeGreaterThanOrEqual(6);
    await details.screenshot({ path: `test-results/citation-spacing-${width}.png` });
  }
});
