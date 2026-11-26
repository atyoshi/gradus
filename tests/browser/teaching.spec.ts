import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { parseKern, blank, type Score } from "../../src/model";
import { lessons } from "../../src/teaching";

async function draft(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("gradus-recovery")!),
  );
}
async function recover(page: Page, score: Score) {
  await page.addInitScript(
    (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
    score,
  );
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
}
const rows = JSON.parse(fs.readFileSync("public/sources/fux.json", "utf8"));
const source = (id: string) =>
  parseKern(rows.find((r: any) => r.metadata.id === id));

test("the Aeolian second-species cadence passes and still rejects the wrong fifth", async ({ page }) => {
  const s = source("gap_042");
  const downbeat = s.voices[0].notes.at(-3)!;
  await recover(page, s);
  const passed = page.getByRole("heading", { name: "Practice checks passed." });
  await expect(passed).toBeVisible();
  const slot = page.locator(`[data-note="${downbeat.id}"]`);
  await slot.focus();
  await slot.press("Enter");
  await page.getByRole("button", { name: "Natural", exact: true }).click();
  await expect(page.getByRole("region", { name: "Rule violations" })
    .getByRole("button", { name: /Cadential downbeat Bar 10/ })).toBeVisible();
  await page.getByRole("button", { name: "Sharp", exact: true }).click();
  await expect(passed).toBeVisible();
  expect((await draft(page)).voices[0].notes.at(-3).pitch).toEqual(downbeat.pitch);
});

test("a recovered first-species cross-relation is flagged until the sharp is corrected", async ({ page }) => {
  const s = blank(source("gap_116"));
  const [upper, cantus, lower] = s.voices;
  upper.notes[0].pitch = { step: "C", octave: 5, alter: 1 };
  upper.notes[1].pitch = { step: "A", octave: 4, alter: 0 };
  for (const note of lower.notes.slice(0, 2))
    note.pitch = { step: "A", octave: 2, alter: 0 };
  await recover(page, s);
  const finding = page.getByRole("region", { name: "Rule violations" })
    .getByRole("button", { name: /Cross relation Bars 1–2/ });
  await expect(finding).toBeVisible();
  await expect(page.getByRole("img", { name: "Voice 2, bar 2: rule violation" })).toBeVisible();
  const opening = page.locator(`[data-note="${upper.notes[0].id}"]`);
  await opening.focus();
  await opening.press("Enter");
  await page.getByRole("button", { name: "Natural", exact: true }).click();
  await expect(finding).toHaveCount(0);
  expect((await draft(page)).voices[0].notes[0].pitch.alter).toBe(0);
  expect((await draft(page)).voices[1].notes).toEqual(cantus.notes);
});

test("finding lessons play and preserve the draft, selection and undo history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await recover(page, blank(source("gap_005")));
  const first = page.locator('[data-note="v1n0"]');
  await first.focus();
  await first.press("Enter");
  await page.keyboard.press("e"); // A second above the given D.
  await page.locator(".finding-item > .finding").first().click();
  await expect(
    page.locator(".finding-item .finding-details").first(),
  ).toContainText(/bar 1, beat 1/);
  const before = await draft(page);
  const selected = await page
    .locator('[data-note][fill="var(--selection)"]')
    .getAttribute("data-note");
  await expect(page.getByTitle("Undo", { exact: true })).toBeEnabled();
  await page.locator(".finding-reference > summary").first().click();
  await page.locator(".finding-lesson").first().click();
  await expect(
    page.getByRole("heading", { name: "Understand what you hear." }),
  ).toBeVisible();
  await expect(page.locator(".lesson-panel svg")).toBeVisible();
  await page.keyboard.press("a");
  await page.locator(".lesson-panel [data-note]").first().click();
  expect(await draft(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Listen to example", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop example", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator('.lesson-panel [fill="var(--playhead)"]').count())
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stop example", exact: true }).click();
  await page
    .getByRole("button", { name: "Return to your exercise", exact: true })
    .click();
  expect(await draft(page)).toEqual(before);
  await expect(page.locator(`[data-note="${selected}"]`)).toHaveAttribute(
    "fill",
    "var(--selection)",
  );
  await page.getByTitle("Undo", { exact: true }).click();
  expect((await draft(page)).voices[0].notes[0].pitch).toBeNull();
  await page.getByTitle("Redo", { exact: true }).click();
  expect(await draft(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("all eleven lessons render, compare examples, and fit the mobile and dark layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await recover(page, blank(source("gap_005")));
  await page.getByRole("button", { name: /Lessons/ }).click();
  for (const lesson of lessons) {
    await page
      .locator(".lesson-card")
      .filter({
        has: page.getByRole("heading", { name: lesson.title, exact: true }),
      })
      .click();
    await expect(page.locator(".lesson-panel h2")).toHaveText(lesson.title);
    await expect(page.locator(".lesson-panel svg")).toBeVisible();
    await expect(page.locator(".lesson-panel a")).toHaveAttribute(
      "href",
      /^https:\/\/www.digital.wienbibliothek.at/,
    );
  }
  await page
    .locator(".lesson-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Hear independent voices",
        exact: true,
      }),
    })
    .click();
  await page
    .getByRole("button", { name: "Contrary motion", exact: true })
    .click();
  await expect(page.locator(".lesson-panel figcaption")).toContainText(
    "bass falls",
  );
  await page.screenshot({
    path: "test-results/lesson-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Appearance").selectOption("dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/lesson-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("source evidence exposes every original disagreement and retains unresolved results", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Sources/ }).click();
  await expect(page.locator(".source-review-list")).toContainText(
    "46 original disagreements reviewed",
  );
  await page
    .getByLabel("Show unresolved or editorial questions only")
    .uncheck();
  await expect(page.locator(".source-review-list details")).toHaveCount(46);
  const corrected = page
    .locator(".source-review-list details")
    .filter({ has: page.locator("summary", { hasText: "Figure 015" }) });
  await corrected.locator("summary").click();
  await expect(corrected).toContainText(/corrected/i);
  await expect(corrected.locator("a")).toHaveAttribute("href", /^https:/);
  await page.getByLabel("Show unresolved or editorial questions only").check();
  const unresolved = page
    .locator(".source-review-list details")
    .filter({ has: page.locator("summary", { hasText: "Figure 204" }) });
  await unresolved.locator("summary").click();
  await expect(unresolved).toContainText("Current result: violations");
});

test("an old verified score with unsettled ficta receives review status in the score and path", async ({
  page,
  request,
}) => {
  const templates: Score[] = JSON.parse(
    fs.readFileSync("public/sources/practice.json", "utf8"),
  );
  const s: Score = structuredClone(
    templates.find((x) => x.id === "cantus-Dorian")!,
  );
  s.id = "path-cantus-Dorian";
  s.path = { studyId: "cantus-Dorian", species: 1, voices: 1, mode: "Dorian" };
  s.title = "Old verified modal attempt";
  s.validationVersion = "fux-1725-v2";
  s.verified = true;
  s.voices[0].notes[1].pitch!.alter = 1;
  expect((await request.post("/api/library", { data: s })).ok()).toBe(true);
  await recover(page, s);
  await expect(
    page.getByRole("heading", { name: "Source review needed.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Practice checks passed.", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "What is working", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Next exercise →", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#feedback-context")).toContainText(
    "Needs context",
  );
  await expect(
    page.locator(".finding-item .finding-details").first(),
  ).toContainText("F♯4, bar 2");
  await page.getByRole("button", { name: /The path/ }).click();
  // Select by retained study title, independent of existing notebook contents.
  const study = page.locator(".exercise").filter({
    has: page.getByRole("heading", {
      name: templates.find((x: Score) => x.id === s.path!.studyId)!.title,
      exact: true,
    }),
  });
  await expect(study).toContainText("Source review needed · resume");
  await expect(study).toContainText("Focus:");
});

test("sample answers show their own unresolved findings and cannot erase the draft by keyboard", async ({
  page,
}) => {
  const original = source("gap_204"),
    s = blank(original);
  s.voices[0].notes[0].pitch = original.voices[0].notes[0].pitch;
  await recover(page, s);
  const before = await draft(page);
  await page
    .getByRole("button", { name: "Sample answer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Return to my work", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".feedback-group.error h3")).toContainText(
    /Rule violations/,
  );
  await expect(
    page.getByRole("heading", { name: "Practice checks passed.", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".hint")
      .filter({ hasText: "This source answer has findings requiring review" }),
  ).toBeVisible();
  await page.locator(".score-scroll").focus();
  await page.keyboard.press("Backspace");
  expect(await draft(page)).toEqual(before);
  await expect(
    page.getByRole("button", { name: "Return to my work", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to my work", exact: true })
    .click();
  expect(await draft(page)).toEqual(before);
});
