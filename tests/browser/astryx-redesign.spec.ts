import { test, expect } from "@playwright/test";

test("notebook navigation uses a notebook icon rather than a text glyph", async ({ page }) => {
  await page.goto("/");
  const notebook = page.getByLabel("Studio").getByRole("button", { name: /Your notebook/ });
  await expect(notebook.locator("svg[aria-hidden='true']")).toBeVisible();
  await notebook.click();
  await expect(notebook).toHaveAttribute("aria-current", "page");
});

test("editor controls have visible functional group labels", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  for (const group of ["Edit history", "Pitch controls", "Rhythm controls", "Line tools"]) {
    const label = await page.getByRole("group", { name: group }).evaluate(e => getComputedStyle(e, "::before").content);
    expect(label).toContain(group);
  }
});

test("line tools use the same spacing as the rhythm controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    const gaps = await page.locator(".note-toolbar").evaluate((toolbar) => {
      const rect = (selector: string) => toolbar.querySelector(selector)!.getBoundingClientRect();
      const rhythm = Array.from(toolbar.querySelector('[aria-label="Rhythm controls"]')!.children, e => e.getBoundingClientRect());
      const hint = rect('[aria-label="Line tools"] button:nth-child(1)');
      const clear = rect('[aria-label="Line tools"] button:nth-child(2)');
      return { rhythm: rhythm[1].left - rhythm[0].right, tools: clear.left - hint.right };
    });
    expect(gaps.rhythm).toBeGreaterThanOrEqual(6);
    expect(gaps.tools).toBe(gaps.rhythm);
  }
});

test("editor keeps pitch readout beside pitch controls and utility actions together", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  const pitch = page.getByRole("group", { name: "Pitch controls", exact: true });
  await expect(pitch).toBeVisible();
  await expect(pitch.locator(".selection")).toBeVisible();
  const readout = await pitch.locator(".selection").boundingBox();
  const raise = await pitch.getByRole("button", { name: "Raise pitch" }).boundingBox();
  expect(Math.abs(readout!.y - raise!.y)).toBeLessThan(20);
  expect(Math.abs(readout!.x - raise!.x)).toBeLessThan(100);
  const utilities = page.getByRole("group", { name: "Line tools", exact: true });
  await expect(utilities.getByRole("button", { name: "Pitch hints" })).toHaveClass(/astryx-button/);
  const hints = await utilities.getByRole("button", { name: "Pitch hints" }).boundingBox();
  const clear = await utilities.getByRole("button", { name: "Clear line" }).boundingBox();
  expect(hints!.y).toBe(clear!.y);
});

test("path filter has breathing room around its label and progress notice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "The path", exact: true }).click();
  const spacing = await page.getByLabel("Path mode").evaluate((select) => {
    const label = select.parentElement!;
    const range = document.createRange();
    range.selectNodeContents(label.firstChild!);
    const text = range.getBoundingClientRect();
    const box = select.getBoundingClientRect();
    const notice = document.querySelector(".path-progress")!.getBoundingClientRect();
    return { labelGap: box.left - text.right, noticeGap: notice.top - box.bottom };
  });
  expect(spacing.labelGap).toBeGreaterThanOrEqual(10);
  expect(spacing.noticeGap).toBeGreaterThanOrEqual(16);
});

test("studio navigation and Astryx actions stay usable in dark mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Studio")).toBeVisible();
  await expect(page.locator(".engraving svg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lesson", exact: true })).toHaveClass(/astryx-button/);
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "The path" }).click();
  await expect(page.getByLabel("Studio").getByRole("button", { name: "The path", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Appearance")).toHaveValue("dark");
});

test("studio uses a blue-gray dark palette and a real custom Astryx theme", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-astryx-theme", "gradus");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(17, 24, 39)");
});

test("navigation fits a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Practice", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
