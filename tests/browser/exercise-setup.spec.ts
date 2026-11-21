import { test, expect } from "@playwright/test";

test("new exercise opens a contained menu and Escape closes it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  const setup = await page.locator(".exercise-setup").boundingBox();
  expect(setup!.height).toBeLessThanOrEqual(1000);
  expect(await page.locator(".exercise-setup").evaluate(e => getComputedStyle(e).position)).toBe("fixed");
  await page.keyboard.press("Escape");
  await expect(page.locator(".exercise-setup")).not.toHaveAttribute("open", "");
});

test("generation explains unavailable combinations and setup remains legible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await page.getByLabel("Species", { exact: true }).selectOption("5");
  await page.getByLabel("Voices", { exact: true }).selectOption("4");
  await page.getByLabel("Mode", { exact: true }).selectOption("Ionian");
  await page.getByLabel("Cantus position", { exact: true }).selectOption("3");
  const generate = page.getByRole("button", { name: "Generate new cantus +" });
  await expect(generate).toBeDisabled();
  await expect(page.getByText(/No verified source matches these settings/)).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    for (const width of [1440, 850, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const setup = page.locator(".exercise-setup");
      const box = await setup.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      const geometry = await setup.evaluate((node) => {
        const scratch = node.querySelector(".cantus-action")!.getBoundingClientRect();
        const controls = node.querySelector(".setup")!.getBoundingClientRect();
        return controls.top - scratch.bottom;
      });
      expect(geometry).toBeGreaterThanOrEqual(16);
    }
  }
});
