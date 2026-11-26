import { expect, test, type Page } from "@playwright/test";
import { emptyPattern } from "../../src/editor";
import { pitch, type Score } from "../../src/model";

const fixture: Score = {
  version: 1, id: "florid-step-entry", title: "Florid step entry", species: 5, mode: "Dorian", bars: 4,
  voices: [
    { id: "fl", name: "Florid", locked: false, species: 5, notes: emptyPattern("fl", 4, 5) },
    { id: "cf", name: "Cantus", locked: true, species: 1, notes: emptyPattern("cf", 4, 1).map(n => ({ ...n, pitch: pitch(21) })) },
  ],
};
const slot = (page: Page, time: number) => page.locator(`[data-note="fln${time}"]`);
const draft = (page: Page): Promise<Score> => page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")!));
const selected = (page: Page, time: number) => expect(slot(page, time)).toHaveAttribute("fill", "var(--selection)");

async function open(page: Page, score = fixture) {
  await page.addInitScript(s => localStorage.setItem("gradus-recovery", JSON.stringify(s)), score);
  await page.goto("/");
  await expect(slot(page, 0)).toBeVisible();
  await page.locator(".score-scroll").focus();
}

// MuseScore Studio step-time at 72cfe43ee53926963d68fc2acc7968f658a87e81:
// share/testflowscripts/TC3_UsingNoteInputToolbar.js (duration then pitch),
// src/engraving/editing/noteinput.cpp (addPitch / putNote), and edit.cpp (enterRest).
test("mouse placement hands the next beat directly to keyboard entry", async ({ page }) => {
  await open(page);
  const before = await draft(page);
  await page.getByRole("button", { name: /^Quarter note/ }).click();
  await selected(page, 0);
  expect(await draft(page)).toEqual(before);
  await slot(page, 0).hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", "2");
  await slot(page, 0).click();
  await selected(page, 2);
  await page.keyboard.press("a");
  await selected(page, 4);
  expect((await draft(page)).voices[0].notes.slice(0, 2)).toEqual([
    expect.objectContaining({ time: 0, duration: 2, pitch: expect.any(Object) }),
    expect.objectContaining({ time: 2, duration: 2, pitch: expect.objectContaining({ step: "A" }) }),
  ]);
});

test("a shorter value fits before a later written note without skipping its start", async ({ page }) => {
  const score = structuredClone(fixture);
  score.voices[0].notes.find(n => n.time === 4)!.pitch = pitch(28);
  await open(page, score);
  await page.keyboard.press("5");
  await slot(page, 0).hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", "2");
  await page.keyboard.press("a");
  await selected(page, 2);
  await page.keyboard.press("b");
  await selected(page, 4);
  expect((await draft(page)).voices[0].notes.find(n => n.time === 4)).toEqual(score.voices[0].notes.find(n => n.time === 4));
});

test("duration rest buttons and the 0 shortcut place and advance in a guided study", async ({ page }) => {
  const score: Score = { ...fixture, path: { studyId: "florid-step-entry", species: 5, voices: 2, mode: "Dorian" } };
  await open(page, score);
  await expect(page.getByRole("group", { name: "Rhythm controls" }).getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button", { name: "Dotted quarter rest", exact: true }).click();
  await selected(page, 3);
  await page.keyboard.press("0");
  await selected(page, 6);
  await page.keyboard.press("a");
  await selected(page, 8);
  expect((await draft(page)).voices[0].notes.slice(0, 3)).toEqual([
    expect.objectContaining({ time: 0, duration: 3, pitch: null, rest: true }),
    expect.objectContaining({ time: 3, duration: 3, pitch: null, rest: true }),
    expect.objectContaining({ time: 6, duration: 2, pitch: expect.any(Object), rest: false }),
  ]);
  await page.getByTitle("Undo", { exact: true }).click();
  expect((await draft(page)).voices[0].notes.find(n => n.time === 6)?.pitch).toBeNull();
  await page.getByTitle("Redo", { exact: true }).click();
  expect((await draft(page)).voices[0].notes.find(n => n.time === 6)?.pitch).not.toBeNull();
});

test("Figure 82 starts writing after the opening rest without inheriting the model's suspension", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await page.getByLabel("Species", { exact: true }).selectOption("5");
  await page.getByLabel("Voices", { exact: true }).selectOption("2");
  await page.getByLabel("Mode", { exact: true }).selectOption("Dorian");
  await page.locator(".source-picker .exercise").filter({
    has: page.getByRole("heading", { name: "Fux · Figure 82", exact: true }),
  }).click();
  const before = await draft(page);
  const voice = before.voices.find(v => !v.locked)!;
  const target = (time: number) => page.locator(`[data-note="${voice.id}n${time}"]`);
  await expect(target(4)).toHaveAttribute("fill", "var(--selection)");
  expect(voice.notes[0]).toMatchObject({ time: 0, duration: 4, rest: true });
  expect(before.solution?.find(v => v.id === voice.id)?.notes[1].tieStart).toBe(true);
  await page.getByRole("button", { name: /^Quarter note/ }).click();
  await target(4).hover();
  await expect(page.locator(".pitch-preview")).toHaveAttribute("data-preview-duration", "2");
  await page.keyboard.press("a");
  await expect(target(6)).toHaveAttribute("fill", "var(--selection)");
  expect((await draft(page)).voices.find(v => v.id === voice.id)?.notes.find(n => n.time === 8)?.pitch).toBeNull();
  await page.getByRole("button", { name: "Clear line", exact: true }).click();
  expect((await draft(page)).voices.find(v => v.id === voice.id)?.notes.every(n => !n.tieStart && !n.tieStop)).toBe(true);
});

test("dotted blanks and dotted rests keep later beats aligned with the other staff", async ({ page }) => {
  const score = structuredClone(fixture);
  const florid = score.voices[0];
  florid.notes = [
    { id: "fln0", time: 0, duration: 3, pitch: null },
    { id: "fln3", time: 3, duration: 1, pitch: pitch(30) },
    { id: "fln4", time: 4, duration: 2, pitch: pitch(30) },
    { id: "fln6", time: 6, duration: 2, pitch: pitch(30) },
    ...florid.notes.filter(n => n.time >= 8),
  ];
  score.voices.splice(1, 0, { id: "third", name: "Third species", locked: false, species: 3,
    notes: emptyPattern("third", score.bars, 3).map(n => ({ ...n, pitch: pitch(30) })),
  });
  await open(page, score);
  const assertAligned = async () => {
    const difference = await page.locator(".engraving svg").evaluate((svg) => {
      const x = (id: string) => svg.querySelector(`#vf-score-note-${id} .vf-notehead`)!.getBoundingClientRect().x;
      return Math.abs(x("fln4") - x("thirdn4"));
    });
    expect(difference).toBeLessThan(2);
  };
  await assertAligned();
  await page.getByRole("button", { name: "Dotted quarter rest", exact: true }).click();
  await selected(page, 3);
  await assertAligned();
});

for (const [name, duration, symbol, dotted] of [
  ["Whole", 8, "\uE4E3", false], ["Dotted half", 6, "\uE4E4", true],
  ["Half", 4, "\uE4E4", false], ["Dotted quarter", 3, "\uE4E5", true],
  ["Quarter", 2, "\uE4E5", false], ["Eighth", 1, "\uE4E6", false],
] as const) {
  test(`${name} rest places the correct score symbol and advances by its duration`, async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: `${name} rest`, exact: true }).click();
    await selected(page, duration);
    expect((await draft(page)).voices[0].notes[0]).toMatchObject({ time: 0, duration, rest: true, pitch: null });
    const rest = page.locator("#vf-score-note-fln0");
    await expect(rest).toContainText(symbol);
    await expect(rest.locator(".vf-stem")).toHaveCount(0);
    if (dotted) await expect(rest).toContainText("\uE1E7");
    else await expect(rest).not.toContainText("\uE1E7");
  });
}
