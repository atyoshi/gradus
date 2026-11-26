import { expect, test } from "@playwright/test";
import { emptyPattern } from "../../src/editor";
import { pitch, type Score } from "../../src/model";

// Bravura uses SMuFL's individual notes, rests and augmentation dot (E1E7).
const symbols = [
  ["Whole", "\uE1D2", "\uE4E3"], ["Dotted half", "\uE1D3 \uE1E7", "\uE4E4 \uE1E7"],
  ["Half", "\uE1D3", "\uE4E4"], ["Dotted quarter", "\uE1D5 \uE1E7", "\uE4E5 \uE1E7"],
  ["Quarter", "\uE1D5", "\uE4E5"], ["Eighth", "\uE1D7", "\uE4E6"],
].flatMap(([name, note, rest]) => [[`${name} note`, note], [`${name} rest`, rest]]);

const score: Score = {
  version: 1, id: "icon-florid", title: "Florid", species: 5, mode: "Dorian", bars: 5,
  voices: [
    { id: "cp", name: "Counterpoint", locked: false, species: 5, notes: emptyPattern("cp", 5, 5) },
    { id: "cf", name: "Cantus", locked: true, species: 1, notes: emptyPattern("cf", 5, 1).map(n => ({ ...n, pitch: pitch(28) })) },
  ],
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(s => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
});

test("rhythm buttons use the Bravura note and rest glyphs for all six values", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  for (const [name, glyph] of symbols) {
    const button = page.getByRole("button", { name: new RegExp(`^${name}`) });
    const icon = button.locator(".duration-glyph text");
    await expect(icon).toHaveText(glyph);
    await expect(icon).toHaveCSS("font-family", /Bravura/);
  }
});

test("the whole rest hangs below its line and the half rest sits above it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const gap = (name: string) => page.getByRole("button", { name, exact: true }).locator("svg").evaluate(svg => {
    const line = svg.querySelector("line");
    if (!line) return null;
    const canvas = document.createElement("canvas").getContext("2d")!;
    canvas.font = "32px Bravura";
    const bounds = canvas.measureText(svg.querySelector("text")!.textContent!);
    const y = Number(line.getAttribute("y1"));
    return { top: y + bounds.actualBoundingBoxAscent, bottom: y - bounds.actualBoundingBoxDescent };
  });
  expect((await gap("Whole rest"))?.top).toBeCloseTo(0, 0);
  expect((await gap("Half rest"))?.bottom).toBeCloseTo(0, 0);
});

test("each rhythm symbol has breathing room and is vertically centered", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const [name] of symbols) {
    const button = page.getByRole("button", { name: new RegExp(`^${name}`) });
    const ink = button.locator(".duration-glyph text");
    await expect(ink).toHaveCount(1);
    const gaps = await ink.evaluate((text) => {
      const element = text as SVGGraphicsElement;
      const canvas = document.createElement("canvas").getContext("2d")!;
      canvas.font = "32px Bravura";
      const bounds = canvas.measureText(element.textContent || "");
      const matrix = element.getScreenCTM()!;
      const top = new DOMPoint(0, -bounds.actualBoundingBoxAscent).matrixTransform(matrix).y;
      const bottom = new DOMPoint(0, bounds.actualBoundingBoxDescent).matrixTransform(matrix).y;
      const rect = element.closest("button")!.getBoundingClientRect();
      const inkLeft = new DOMPoint(-bounds.actualBoundingBoxLeft, 0).matrixTransform(matrix).x;
      const inkRight = new DOMPoint(bounds.actualBoundingBoxRight, 0).matrixTransform(matrix).x;
      const svg = element.closest("svg")!.getBoundingClientRect();
      return { top: top - rect.top, bottom: rect.bottom - bottom, left: inkLeft - svg.left, right: svg.right - inkRight };
    });
    expect(gaps.top).toBeGreaterThanOrEqual(6);
    expect(gaps.bottom).toBeGreaterThanOrEqual(6);
    expect(Math.abs(gaps.top - gaps.bottom)).toBeLessThanOrEqual(3);
    expect(gaps.left).toBeGreaterThanOrEqual(2);
    expect(gaps.right).toBeGreaterThanOrEqual(2);
  }
  const toolbar = page.getByRole("group", { name: "Rhythm controls" });
  for (const [width, theme] of [[1512, "dark"], [700, "light"]] as const) {
    await page.setViewportSize({ width, height: 1100 });
    await page.getByLabel("Appearance").selectOption(theme);
    const fits = await toolbar.evaluate(el => Array.from(el.querySelectorAll("button")).every(button => {
      const b = button.getBoundingClientRect();
      return b.left >= 0 && b.right <= window.innerWidth + 1;
    }));
    expect(fits).toBe(true);
    await toolbar.screenshot({ path: testInfo.outputPath(`florid-toolbar-${theme}.png`) });
  }
});
