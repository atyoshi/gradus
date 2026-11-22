import { test, expect, type Page } from "@playwright/test";
import { type Score } from "../../src/model";

async function openStudy(page: Page) {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await page.getByLabel("Species", { exact: true }).selectOption("1");
  await page.getByLabel("Voices", { exact: true }).selectOption("2");
  await page.getByLabel("Mode", { exact: true }).selectOption("Dorian");
  await page
    .locator(".source-picker .exercise")
    .filter({
      has: page.getByRole("heading", { name: "Fux · Figure 5", exact: true }),
    })
    .click();
}

async function draft(page: Page): Promise<Score> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("gradus-recovery")!),
  );
}

async function selectSlot(page: Page, id: string) {
  const slot = page.locator(`[data-note="${id}"]`);
  await slot.focus();
  await slot.press("Enter");
}

test("duration controls agree when a whole note cannot fit at the barline", async ({ page }) => {
  await openStudy(page);
  await page.getByRole("button", { name: /^Half note/ }).click();
  await selectSlot(page, "v1n8");
  await page.keyboard.press("a");
  await expect(page.locator('[data-note="v1n12"]')).toHaveAttribute("fill", "var(--selection)");
  await page.getByRole("button", { name: /^Whole note/ }).click();
  await expect(page.getByLabel("Note duration", { exact: true })).toHaveValue("4");
  await expect(page.getByRole("button", { name: /^Half note/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Whole note/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status").filter({ hasText: "Only half" })).toBeVisible();
  await page.keyboard.press("b");
  expect((await draft(page)).voices[0].notes.find((n) => n.time === 12)?.duration).toBe(4);
  await expect(page.getByRole("button", { name: /^Whole note/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Note duration", { exact: true })).toHaveValue("8");
});

for (const [name, shortcut, duration] of [["Whole", "7", 8], ["Half", "6", 4], ["Quarter", "5", 2], ["Eighth", "4", 1]] as const) {
  test(`${name} button and shortcut agree with preview and keyboard entry`, async ({ page }) => {
    await openStudy(page);
    await selectSlot(page, "v1n8");
    const button = page.getByRole("button", { name: new RegExp(`^${name} note`) });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Note duration", { exact: true })).toHaveValue(String(duration));
    await page.locator('[data-note="v1n8"]').hover();
    await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", String(duration));
    await page.keyboard.press("a");
    expect((await draft(page)).voices[0].notes.find((n) => n.time === 8)?.duration).toBe(duration);
    await selectSlot(page, "v1n16");
    await page.keyboard.press(shortcut);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("b");
    expect((await draft(page)).voices[0].notes.find((n) => n.time === 16)?.duration).toBe(duration);
  });
}

for (const [eighths, expected] of [[1, 6], [3, 4]] as const) {
  test(`whole-note preference after ${eighths} eighths chooses a notatable duration`, async ({ page }) => {
    await openStudy(page);
    await page.getByRole("button", { name: /^Eighth note/ }).click();
    await selectSlot(page, "v1n8");
    for (let i = 0; i < eighths; i++) await page.keyboard.press("a");
    const slot = page.locator(`[data-note="v1n${8 + eighths}"]`);
    await page.getByRole("button", { name: /^Whole note/ }).click();
    await expect(page.getByLabel("Note duration", { exact: true })).toHaveValue(String(expected));
    await slot.hover();
    await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", String(expected));
    await page.keyboard.press("b");
    const measure = (await draft(page)).voices[0].notes.filter((n) => n.time >= 8 && n.time < 16);
    expect(measure.find((n) => n.time === 8 + eighths)?.duration).toBe(expected);
    expect(measure.every((n) => [1, 2, 3, 4, 6, 8].includes(n.duration))).toBe(true);
    expect(measure.reduce((sum, n) => sum + n.duration, 0)).toBe(8);
  });
}

test("a protected written note shows the actual duration and preserves the later note", async ({ page }) => {
  await openStudy(page);
  await page.getByLabel("Note duration", { exact: true }).selectOption("4");
  await selectSlot(page, "v1n8");
  await page.keyboard.press("a");
  await page.keyboard.press("b");
  const before = await draft(page);
  await selectSlot(page, "v1n8");
  await page.getByRole("button", { name: /^Whole note/ }).click();
  await expect(page.getByRole("button", { name: /^Half note/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "protect written music" })).toBeVisible();
  await page.keyboard.press("c");
  const after = await draft(page);
  expect(after.voices[0].notes.find((n) => n.time === 12)).toEqual(before.voices[0].notes.find((n) => n.time === 12));
});

for (const duration of [4, 2]) {
  test(`keyboard retains duration ${duration}, advances through new slots, and undoes one entry`, async ({
    page,
  }) => {
    await openStudy(page);
    const control = page.getByLabel("Note duration", { exact: true });
    await control.selectOption(String(duration));
    const before = await draft(page);
    await selectSlot(page, "v1n8");
    await expect(control).toHaveValue(String(duration));
    expect(await draft(page)).toEqual(before);

    await page.locator('[data-note="v1n8"]').hover();
    await expect(page.locator(".pitch-preview")).toHaveAttribute(
      "data-preview-duration",
      String(duration),
    );
    expect(await draft(page)).toEqual(before);
    await page.keyboard.press("a");
    await expect(
      page.locator(`[data-note="v1n${8 + duration}"]`),
    ).toHaveAttribute("fill", "var(--selection)");
    const entered = await draft(page);
    expect(
      entered.voices[0].notes
        .filter((n) => n.time >= 8 && n.time < 16)
        .map((n) => n.duration),
    ).toEqual(Array(8 / duration).fill(duration));
    expect(entered.voices[1]).toEqual(before.voices[1]);

    await page.getByTitle("Undo", { exact: true }).click();
    expect(await draft(page)).toEqual(before);
    await expect(page.locator('[data-note="v1n8"]')).toHaveAttribute(
      "fill",
      "var(--selection)",
    );
    await page.getByTitle("Redo", { exact: true }).click();
    expect(await draft(page)).toEqual(entered);

    await selectSlot(page, `v1n${8 + duration}`);
    for (let i = 1; i < 8 / duration; i++) await page.keyboard.press("b");
    await expect(page.locator('[data-note="v1n16"]')).toHaveAttribute(
      "fill",
      "var(--selection)",
    );
    await expect(control).toHaveValue(String(duration));
    await page.keyboard.press("c");
    await expect(
      page.locator(`[data-note="v1n${16 + duration}"]`),
    ).toHaveAttribute("fill", "var(--selection)");
    const saved = await draft(page);
    const attemptId = saved.id;
    await expect
      .poll(async () => {
        const library: Score[] = await (
          await page.request.get("/api/library")
        ).json();
        const found = library.find((s) => s.id === attemptId);
        if (!found) return found;
        const { libraryUpdatedAt: _updated, ...score } = found;
        return score;
      })
      .toEqual(saved);
    await page.reload();
    await expect(
      page.locator(`[data-note="v1n${16 + duration}"]`),
    ).toBeVisible();
    expect(await draft(page)).toEqual(saved);
    // The session preference resets on reload, so this untouched bar is whole.
    await selectSlot(page, "v1n24");
    await expect(control).toHaveValue("8");
  });

  test(`mouse entry and preview retain duration ${duration} across measures`, async ({
    page,
  }) => {
    await openStudy(page);
    const control = page.getByLabel("Note duration", { exact: true });
    await control.selectOption(String(duration));
    for (const time of [8, 16]) {
      const slot = page.locator(`[data-note="v1n${time}"]`);
      await slot.hover();
      await expect(page.locator(".pitch-preview")).toHaveAttribute(
        "data-preview-duration",
        String(duration),
      );
      await slot.click();
      const s = await draft(page);
      const notes = s.voices[0].notes.filter(
        (n) => n.time >= time && n.time < time + 8,
      );
      expect(notes.map((n) => n.duration)).toEqual(
        Array(8 / duration).fill(duration),
      );
      expect(notes[0].pitch).not.toBeNull();
    }
    await selectSlot(page, "v1n24");
    await expect(control).toHaveValue(String(duration));
  });
}

test("dotted remainders keep the preference and existing music keeps its rhythm", async ({
  page,
}) => {
  await openStudy(page);
  const control = page.getByLabel("Note duration", { exact: true });
  // A written whole note must remain whole when later selected or edited.
  await page.locator('[data-note="v1n16"]').click();
  await selectSlot(page, "v1n0");
  await control.selectOption("3");
  await selectSlot(page, "v1n8");
  await page.keyboard.press("a");
  await page.keyboard.press("b");
  await expect(control).toHaveValue("2");
  await page.locator('[data-note="v1n14"]').hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute(
    "data-preview-duration",
    "2",
  );
  await page.keyboard.press("c");
  await expect(control).toHaveValue("8");
  const before = await draft(page);
  await page.keyboard.press("d");
  const after = await draft(page);
  expect(
    after.voices[0].notes
      .filter((n) => n.time >= 16 && n.time < 24)
      .map((n) => n.duration),
  ).toEqual([8]);
  expect(after.voices[0].notes.filter((n) => n.time < 16)).toEqual(
    before.voices[0].notes.filter((n) => n.time < 16),
  );
  await expect(control).toHaveValue("3");
  await page.keyboard.press("e");
  expect(
    (await draft(page)).voices[0].notes
      .filter((n) => n.time >= 24 && n.time < 32)
      .map((n) => n.duration),
  ).toEqual([3, 3, 2]);
});

test("opening another exercise resets duration memory and path rhythms stay assigned", async ({
  page,
}) => {
  await openStudy(page);
  const control = page.getByLabel("Note duration", { exact: true });
  await control.selectOption("2");
  await page.locator(".exercise-setup > summary").click();
  await page
    .getByRole("button", { name: "Start from scratch", exact: true })
    .click();
  await expect(control).toHaveValue("8");
  await selectSlot(page, "v1n8");
  await page.keyboard.press("a");
  expect((await draft(page)).voices[0].notes.map((n) => n.duration)).toEqual(
    Array(8).fill(8),
  );
  await control.selectOption("2");
  await page.getByRole("button", { name: /The path/ }).click();
  const stage = page.locator(".path-stage").filter({
    has: page.getByRole("heading", { name: "Note against note", exact: true }),
  });
  await stage.locator("summary").click();
  await stage.locator(".exercise").first().click();
  await expect(control).toBeDisabled();
  const assigned = await draft(page);
  expect(assigned.path).toBeDefined();
  expect(assigned.cantusOnly).not.toBe(true);
  expect(assigned.species).toBe(1);
  expect(assigned.voices).toHaveLength(2);
  await page.locator(".score-scroll").focus();
  await page.keyboard.press("a");
  const entered = await draft(page);
  expect(
    entered.voices.map((v) =>
      v.notes.map((n) => [
        n.id,
        n.time,
        n.duration,
        n.rest,
        n.tieStart,
        n.tieStop,
      ]),
    ),
  ).toEqual(
    assigned.voices.map((v) =>
      v.notes.map((n) => [
        n.id,
        n.time,
        n.duration,
        n.rest,
        n.tieStart,
        n.tieStop,
      ]),
    ),
  );
});

test("rest entry uses the chosen duration and eighth-note previews include a flag", async ({
  page,
}) => {
  await openStudy(page);
  const control = page.getByLabel("Note duration", { exact: true });
  await control.selectOption("4");
  await selectSlot(page, "v1n8");
  await page.getByRole("button", { name: "Rest", exact: true }).click();
  const withRest = await draft(page);
  const notes = withRest.voices[0].notes.filter(
    (n) => n.time >= 8 && n.time < 16,
  );
  expect(notes.map((n) => n.duration)).toEqual([4, 4]);
  expect(notes[0].rest).toBe(true);
  await selectSlot(page, "v1n0");
  await control.selectOption("1");
  await selectSlot(page, "v1n12");
  await expect(control).toHaveValue("1");
  await page.keyboard.press("a");
  expect(
    (await draft(page)).voices[0].notes
      .filter((n) => n.time >= 8 && n.time < 16)
      .map((n) => n.duration),
  ).toEqual([4, 1, 1, 1, 1]);
  expect((await draft(page)).voices[0].notes.find((n) => n.time === 8)).toEqual(
    notes[0],
  );
  await selectSlot(page, "v1n16");
  await page.locator('[data-note="v1n16"]').hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute(
    "data-preview-duration",
    "1",
  );
  await expect(page.locator(".pitch-preview .vf-flag")).toBeVisible();
  const before = await draft(page);
  await page.locator('[data-note="v1n16"]').click();
  expect(
    (await draft(page)).voices[0].notes
      .filter((n) => n.time >= 16 && n.time < 24)
      .map((n) => n.duration),
  ).toEqual(Array(8).fill(1));
  await page.getByTitle("Undo", { exact: true }).click();
  expect(await draft(page)).toEqual(before);
});
