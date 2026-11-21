import { expect, test } from "@playwright/test";

test("space opens the focused setup summary instead of starting playback", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  const setup = page.locator(".exercise-setup");
  await setup.locator("summary").first().focus();
  await page.keyboard.press("Space");
  await expect(setup).toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "Play score", exact: true })).toBeVisible();
});

test("choosing a source closes the setup panel so the score can be used", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  const setup = page.locator(".exercise-setup");
  await setup.locator("summary").first().click();
  await setup.locator(".exercise").first().click();
  await expect(setup).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Playback & display", exact: true }).click();
  await expect(page.getByLabel("Instrument", { exact: true })).toBeVisible();
});
