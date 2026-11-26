import { test, expect, type Page } from "@playwright/test";
import { emptyPattern } from "../../src/editor";
import { pitch, type Score } from "../../src/model";

const draft = (page: Page): Promise<Score> => page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")!));
for (const species of [1, 2, 3, 4] as const) {
  test(`species ${species} keeps assigned durations through keyboard entry`, async ({ page }) => {
    const score: Score = {
      version: 1, id: `rhythm-browser-${species}`, title: "Rhythm", species, mode: "Dorian", bars: 5,
      voices: [
        { id: "cp", name: "Counterpoint", locked: false, species, notes: emptyPattern("cp", 5, species) },
        { id: "cf", name: "Cantus", locked: true, species: 1, notes: emptyPattern("cf", 5, 1).map((n) => ({ ...n, pitch: pitch(28) })) },
      ],
    };
    await page.addInitScript((s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
    await page.goto("/");
    const slot = page.locator('[data-note="cpn8"]');
    await slot.focus();
    await slot.press("Enter");
    await expect(page.getByRole("group", { name: "Next note duration" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: /^Place rest/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rest", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Add|Remove) tie$/ })).toHaveCount(species === 2 ? 0 : 1);
    const before = await draft(page);
    for (const key of ["4", "5", "6", "7", "0"]) await page.keyboard.press(key);
    expect(await draft(page)).toEqual(before);
    await page.keyboard.press("a");
    const after = await draft(page);
    expect(after.voices[0].notes.find(n => n.id === "cpn8")?.pitch).toEqual(expect.any(Object));
    expect(after.voices[0].notes.map((n) => [n.id, n.time, n.duration])).toEqual(before.voices[0].notes.map((n) => [n.id, n.time, n.duration]));
    expect(after.voices[1]).toEqual(before.voices[1]);
  });
}

test("switching voices retains florid choice without changing fixed-species rhythm", async ({ page }) => {
  const score: Score = {
    version: 1, id: "mixed-rhythm", title: "Mixed", species: 5, mode: "Dorian", bars: 5,
    voices: [
      { id: "fl", name: "Florid", locked: false, species: 5, notes: emptyPattern("fl", 5, 5) },
      { id: "cp", name: "Second", locked: false, species: 2, notes: emptyPattern("cp", 5, 2) },
      { id: "cf", name: "Cantus", locked: true, species: 1, notes: emptyPattern("cf", 5, 1).map(n => ({ ...n, pitch: pitch(28) })) },
    ],
  };
  await page.addInitScript(s => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
  await page.goto("/");
  const select = async (id: string) => { const slot = page.locator(`[data-note="${id}"]`); await slot.focus(); await slot.press("Enter"); };
  await select("fln8");
  await page.keyboard.press("4");
  await expect(page.getByRole("button", { name: /^Eighth note/ })).toHaveAttribute("aria-pressed", "true");
  await select("cpn8");
  await expect(page.getByRole("group", { name: "Next note duration" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: /^Place rest/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(Add|Remove) tie$/ })).toHaveCount(0);
  const before = await draft(page);
  await page.keyboard.press("7");
  await page.keyboard.press("t");
  await page.keyboard.press("a");
  const after = await draft(page);
  expect(after.voices[1].notes.find(n => n.id === "cpn8")?.pitch).toEqual(expect.any(Object));
  expect(after.voices[1].notes.map(n => [n.id, n.time, n.duration, n.tieStart, n.tieStop])).toEqual(before.voices[1].notes.map(n => [n.id, n.time, n.duration, n.tieStart, n.tieStop]));
  const floridSlot = page.locator('[data-note="fln8"]');
  await floridSlot.hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", "1");
  await floridSlot.click();
  expect((await draft(page)).voices[0].notes.find(n => n.id === "fln8")?.duration).toBe(1);
  await select("fln8");
  await expect(page.getByRole("button", { name: /^Eighth note/ })).toHaveAttribute("aria-pressed", "true");
});

test("a guided florid study accepts duration buttons and shortcuts", async ({ page }) => {
  const score: Score = {
    version: 1, id: "guided-florid", title: "Guided florid", species: 5, mode: "Dorian", bars: 5,
    path: { studyId: "guided-florid", species: 5, voices: 2, mode: "Dorian" },
    voices: [
      { id: "fl", name: "Florid", locked: false, species: 5, notes: emptyPattern("fl", 5, 5) },
      { id: "cf", name: "Cantus", locked: true, species: 1, notes: emptyPattern("cf", 5, 1).map(n => ({ ...n, pitch: pitch(28) })) },
    ],
  };
  await page.addInitScript(s => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
  await page.goto("/");
  const slot = page.locator('[data-note="fln8"]');
  await slot.focus();
  await slot.press("Enter");
  await page.getByRole("button", { name: /^Half note/ }).click();
  await expect(page.getByRole("button", { name: /^Half note/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("4");
  await expect(page.getByRole("button", { name: /^Eighth note/ })).toHaveAttribute("aria-pressed", "true");
  await slot.hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", "1");
  await slot.click();
  const entered = await draft(page);
  expect(entered.voices[0].notes.find(n => n.id === "fln8")).toMatchObject({ duration: 1, pitch: expect.any(Object) });
  expect(entered.voices[1]).toEqual(score.voices[1]);
  const closing = page.locator('[data-note="fln32"]');
  await closing.focus();
  await closing.press("Enter");
  await expect(page.getByRole("group", { name: "Next note duration" })).toHaveCount(0);
  const rests = page.getByRole("group", { name: /^Place rest/ }).getByRole("button");
  await expect(rests).toHaveCount(6);
  for (const rest of await rests.all()) await expect(rest).toBeDisabled();
  await closing.hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", "8");
  await closing.click();
  expect((await draft(page)).voices[0].notes.at(-1)).toMatchObject({ time: 32, duration: 8, pitch: expect.any(Object) });
});

test("two-voice second species permits the opening half rest only", async ({ page }) => {
  const score: Score = {
    version: 1, id: "second-rest", title: "Second-species rests", species: 2, mode: "Dorian", bars: 5,
    voices: [
      { id: "cp", name: "Counterpoint", locked: false, species: 2, notes: emptyPattern("cp", 5, 2) },
      { id: "cf", name: "Cantus", locked: true, species: 1, notes: emptyPattern("cf", 5, 1).map(n => ({ ...n, pitch: pitch(28) })) },
    ],
  };
  await page.addInitScript(s => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
  await page.goto("/");
  const select = async (id: string) => { const slot = page.locator(`[data-note="${id}"]`); await slot.focus(); await slot.press("Enter"); };
  const rest = page.getByRole("button", { name: "Rest", exact: true });
  await select("cpn0");
  await rest.click();
  expect((await draft(page)).voices[0].notes[0]).toMatchObject({ duration: 4, rest: true });
  await select("cpn4");
  await expect(rest).toBeDisabled();
  await page.keyboard.press("a");
  expect((await draft(page)).voices[0].notes[1]).toMatchObject({ duration: 4, pitch: expect.any(Object), rest: false });
});
