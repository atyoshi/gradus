import { test, expect } from "@playwright/test";

test("study help keeps a clear gap above its feedback in both themes and widths", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.getByRole("button", { name: "Sample answer", exact: true }).click();
  const section = page.getByRole("region", { name: "Study help" });
  const hint = section.locator(".hint");
  await expect(hint).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const geometry = await section.evaluate((node) => {
        const hint = node.querySelector(".hint")!.getBoundingClientRect();
        const buttons = Array.from(node.querySelectorAll("button"), (b) => b.getBoundingClientRect());
        return { gap: hint.top - Math.max(...buttons.map((b) => b.bottom)), left: hint.left, right: hint.right, width: window.innerWidth };
      });
      expect(geometry.gap).toBeGreaterThanOrEqual(12);
      expect(geometry.gap).toBeLessThanOrEqual(24);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    }
  }
});
