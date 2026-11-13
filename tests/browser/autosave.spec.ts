import { test, expect } from "@playwright/test";

test("autosaving a note does not reload the development app", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.evaluate(() => {
    (window as any).__documentBeforeEntry = true;
  });
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.getByLabel("Score editor", { exact: true }).focus();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/library") &&
      response.request().method() === "POST",
  );
  await page.keyboard.press("a");
  await saved;
  // Allow the filesystem watcher debounce and any full-reload message to arrive.
  await page.waitForTimeout(1500);
  expect(navigations).toBe(0);
  expect(await page.evaluate(() => (window as any).__documentBeforeEntry)).toBe(
    true,
  );
});

for (const width of [1512, 1000]) {
  test(`editing while scrolled keeps the review mounted and page steady at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "Musical analysis" }),
    ).toBeVisible();
    await page
      .getByLabel("Score editor", { exact: true })
      .evaluate((el: HTMLElement) => el.focus({ preventScroll: true }));
    await page.evaluate(() => {
      window.scrollTo(0, 200);
      const state = { removed: 0, positions: [] as number[] };
      (window as any).__stability = state;
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of Array.from(record.removedNodes)) {
            if (
              node instanceof Element &&
              (node.matches(".analysis-panel") ||
                node.querySelector(".analysis-panel"))
            )
              state.removed++;
          }
      }).observe(document.querySelector(".workspace")!, {
        subtree: true,
        childList: true,
      });
      const sample = () => {
        state.positions.push(window.scrollY);
        if (state.positions.length < 60) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.screenshot({
      path: `test-results/scrolled-${width}-before.png`,
    });
    await page.keyboard.press("a");
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__stability.positions.length),
      )
      .toBe(60);
    const state = await page.evaluate(() => (window as any).__stability);
    expect(state.removed).toBe(0);
    expect(
      Math.max(...state.positions) - Math.min(...state.positions),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/scrolled-${width}-after.png` });
  });
}
