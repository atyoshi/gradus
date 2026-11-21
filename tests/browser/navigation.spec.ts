import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { type Score } from "../../src/model";
import { orderedPath } from "../../src/path";
const seeds: Score[] = JSON.parse(
  fs.readFileSync("public/sources/practice.json", "utf8"),
);

for (const cantusOnly of [false, true]) {
  test(`the path expands only the last-worked ${cantusOnly ? "cantus" : "species"} section`, async ({
    page,
  }) => {
    const draft = seeds.find((s) =>
      cantusOnly ? s.cantusOnly : !s.cantusOnly && s.species === 3,
    )!;
    await page.addInitScript(
      (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
      draft,
    );
    await page.goto("/");
    await expect(page.locator(".engraving svg")).toBeVisible();
    await page.getByRole("button", { name: /The path/ }).click();
    await expect(page.locator(".path-stage[open]")).toHaveCount(1);
    const stages = page.locator(".path-stage");
    await expect(stages.nth(cantusOnly ? 0 : 3)).toHaveAttribute("open", "");
      const worked = stages.locator(".exercise").filter({
        has: page.getByRole("heading", { name: draft.title, exact: true }),
      });
      await expect(worked.locator(".study-badge")).toHaveText("Started");
      await expect(worked).toHaveClass(/study-started/);
    await expect(
      stages
        .nth(cantusOnly ? 1 : 0)
        .locator(".exercise")
        .first(),
    ).toBeHidden();
    await stages
      .nth(cantusOnly ? 1 : 0)
      .locator("summary")
      .click();
    await expect(
      stages
        .nth(cantusOnly ? 1 : 0)
        .locator(".exercise")
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Practice", exact: true }).click();
    await page.getByRole("button", { name: /The path/ }).click();
    await expect(page.locator(".path-stage[open]")).toHaveCount(1);
    await expect(stages.nth(cantusOnly ? 0 : 3)).toHaveAttribute("open", "");
  });
}

test("species expand without replacing the draft and selecting a study is explicit", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  const before = await page.evaluate(() =>
    localStorage.getItem("gradus-recovery"),
  );
  await page.getByRole("button", { name: /The path/ }).click();
  const stage = page.locator(".path-stage").filter({
    has: page.getByRole("heading", { name: "Suspensions", exact: true }),
  });
  await stage.locator("summary").click();
  await expect(stage.locator(".exercise").first()).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("gradus-recovery")),
  ).toBe(before);
  const seed = orderedPath(seeds).find(
    (s) => s.species === 4 && !s.cantusOnly,
  )!;
  await stage
    .locator(".exercise")
    .filter({
      has: page.getByRole("heading", { name: seed.title, exact: true }),
    })
    .click();
  await expect(page.locator(".practice-heading h1")).toHaveText(seed.title);
  await expect(page.locator(".practice-heading")).toContainText("Species 4");
});

test("passing one's own study offers the exact next exercise and preserves the completed work", async ({
  page,
  request,
}) => {
  const order = orderedPath(seeds);
  const completed = structuredClone(order[0]);
  completed.id = "path-" + order[0].id;
  completed.path = {
    studyId: order[0].id,
    species: completed.species,
    voices: completed.voices.length,
    mode: completed.mode,
  };
  await page.addInitScript(
    (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
    completed,
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Next exercise →", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".completion-next")).toContainText(order[1].title);
  await page
    .getByRole("button", { name: "Next exercise →", exact: true })
    .click();
  await expect(page.locator(".practice-heading h1")).toHaveText(order[1].title);
  await expect(
    page.getByRole("button", { name: "Next exercise →", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(async () =>
      (await (await request.get("/api/library")).json())
        .find((s: Score) => s.id === completed.id)
        ?.voices.map((v: Score["voices"][number]) => v.notes),
    )
    .toEqual(completed.voices.map((v) => v.notes));
});

test("tempo can be cleared, typed, committed, clamped and restored", async ({
  page,
}) => {
  await page.goto("/");
  const tempo = page.getByRole("spinbutton", { name: "Tempo", exact: true });
  await tempo.fill("");
  await expect(tempo).toHaveValue("");
  await tempo.pressSequentially("120");
  await expect(tempo).toHaveValue("120");
  await tempo.press("Enter");
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/settings")).json()).tempo,
    )
    .toBe(120);
  await page.reload();
  await expect(tempo).toHaveValue("120");
  await tempo.fill("999");
  await tempo.blur();
  await expect(tempo).toHaveValue("400");
  await tempo.fill("");
  await tempo.blur();
  await expect(tempo).toHaveValue("400");
});

test("expanded path and exercise controls fit a narrow screen in both themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await expect(page.getByLabel("Species", { exact: true })).toHaveCSS(
    "min-height",
    "40px",
  );
  for (const theme of ["light", "dark"]) {
    if (!(await page.locator(".exercise-setup").evaluate((node: HTMLDetailsElement) => node.open)))
      await page.locator(".exercise-setup > summary").click();
    await page.getByLabel("Appearance").selectOption(theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".exercise-setup > summary").click();
    await page.getByRole("button", { name: /The path/ }).click();
    await page.locator(".path-stage > summary").first().click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/path-mobile-${theme}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Practice", exact: true }).click();
  }
});
