import { expect, test } from "@playwright/test";

test("rhythm buttons use consistent Bravura note glyphs", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  for (const [name, glyph] of [["Whole", "\uE1D2"], ["Half", "\uE1D3"], ["Quarter", "\uE1D5"], ["Eighth", "\uE1D7"]]) {
    const button = page.getByRole("button", { name: new RegExp(`^${name} note`) });
    const icon = button.locator(".duration-glyph text");
    await expect(icon).toHaveText(glyph);
    await expect(icon).toHaveCSS("font-family", /Bravura/);
  }
});

test("each rhythm symbol has breathing room and is vertically centered", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const name of ["Whole", "Half", "Quarter", "Eighth"]) {
    const button = page.getByRole("button", { name: new RegExp(`^${name} note`) });
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
      return { top: top - rect.top, bottom: rect.bottom - bottom };
    });
    expect(gaps.top).toBeGreaterThanOrEqual(6);
    expect(gaps.bottom).toBeGreaterThanOrEqual(6);
    expect(Math.abs(gaps.top - gaps.bottom)).toBeLessThanOrEqual(3);
  }
});
