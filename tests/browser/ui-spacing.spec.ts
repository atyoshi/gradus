import { test, expect, type Page } from "@playwright/test";

async function checkButtons(page: Page) {
  const issues = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    ).filter((b) => b.checkVisibility() && b.getBoundingClientRect().width > 0);
    const issues: string[] = [];
    for (const [i, button] of buttons.entries()) {
      const r = button.getBoundingClientRect();
      const name =
        button.innerText || button.title || button.getAttribute("aria-label");
      if (button.scrollWidth > button.clientWidth + 1)
        issues.push(`Clipped label: ${name}`);
      if (r.left < -1 || r.right > innerWidth + 1)
        issues.push(`Outside window: ${name}`);
      for (const other of buttons.slice(i + 1)) {
        if (button.contains(other) || other.contains(button)) continue;
        // The open exercise panel intentionally overlays the workspace.
        if (!!button.closest(".exercise-setup[open]") !== !!other.closest(".exercise-setup[open]")) continue;
        const q = other.getBoundingClientRect();
        if (
          Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 &&
          Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1
        )
          issues.push(
            `Overlapping buttons: ${name} / ${other.innerText || other.title}`,
          );
      }
    }
    return issues;
  });
  expect(issues).toEqual([]);
}

test("buttons fit across practice, setup, notebook, lessons and path at multiple widths", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  for (const width of [1440, 1180, 850, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Practice", exact: true }).click();
    await checkButtons(page);
    await page
      .getByRole("button", { name: "Playback & display", exact: true })
      .click();
    await page.getByLabel("Loop", { exact: true }).check();
    await checkButtons(page);
    await page.screenshot({
      path: `test-results/ui-playback-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Loop", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Playback & display", exact: true })
      .click();
    await page.locator(".exercise-setup > summary").click();
    await checkButtons(page);
    await page.screenshot({
      path: `test-results/ui-setup-${width}.png`,
      fullPage: true,
    });
    await page.locator(".exercise-setup > summary").click();
    for (const name of ["Your notebook", "Lessons", "The path"]) {
      await page.locator("button.nav").filter({ hasText: name }).click();
      if (name === "Your notebook")
        await page.getByText("Notebook backups", { exact: true }).click();
      await checkButtons(page);
      await page.screenshot({
        path: `test-results/ui-${name.replaceAll(" ", "-")}-${width}.png`,
        fullPage: true,
      });
    }
  }
});
