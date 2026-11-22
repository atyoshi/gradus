import { test, expect } from "@playwright/test";

test("duration shortcuts and buttons choose the next note without changing the score", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await expect(page.getByLabel("Score editor")).toBeFocused();
  await expect(page.locator('[data-note="v1n0"]')).toBeVisible();
  const draft = () => page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")!));
  const before = await draft();
  await page.keyboard.press("6");
  await expect(page.getByRole("button", { name: "Half note (6)" })).toHaveAttribute("aria-pressed", "true");
  expect(await draft()).toEqual(before);
  await page.keyboard.press("c");
  await page.getByRole("button", { name: "Quarter note (5)" }).click();
  const afterFirst = await draft();
  expect(afterFirst.voices[0].notes[0].duration).toBe(4);
  await page.keyboard.press("d");
  const afterSecond = await draft();
  expect(afterSecond.voices[0].notes.slice(0, 2).map((n: { duration: number }) => n.duration)).toEqual([4, 2]);
  expect(afterSecond.voices[0].notes[0]).toEqual(afterFirst.voices[0].notes[0]);
});
