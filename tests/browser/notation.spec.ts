import { test, expect } from "@playwright/test";
import type { Score } from "../../src/model";

const score: Score = {
  version: 1,
  id: "notation-review",
  title: "Ledger line review",
  species: 5,
  mode: "Ionian",
  bars: 2,
  clefs: ["treble", "bass"],
  voices: [
    {
      id: "top",
      name: "Counterpoint",
      locked: false,
      notes: [
        {
          id: "low-sharp",
          time: 0,
          duration: 2,
          pitch: { step: "C", octave: 4, alter: 1 },
        },
        {
          id: "low-natural",
          time: 2,
          duration: 2,
          pitch: { step: "C", octave: 4, alter: 0 },
        },
        {
          id: "high",
          time: 4,
          duration: 2,
          pitch: { step: "A", octave: 5, alter: 0 },
        },
        {
          id: "higher",
          time: 6,
          duration: 2,
          pitch: { step: "C", octave: 6, alter: 0 },
        },
        {
          id: "final",
          time: 8,
          duration: 8,
          pitch: { step: "C", octave: 5, alter: 0 },
        },
      ],
    },
    {
      id: "bass",
      name: "Cantus",
      locked: true,
      notes: [0, 8].map((time) => ({
        id: "bass" + time,
        time,
        duration: 8,
        pitch: { step: "C", octave: 3, alter: 0 },
      })),
    },
  ],
};
test("feedback shading stays within the affected voice and has crisp rounded corners", async ({
  page,
}) => {
  const draft: Score = {
    version: 1,
    id: "voice-feedback",
    title: "Voice feedback",
    species: 1,
    mode: "Dorian",
    bars: 4,
    voices: Array.from({ length: 4 }, (_, vi) => ({
      id: `voice${vi}`,
      name: `Voice ${vi + 1}`,
      locked: vi === 1,
      notes: Array.from({ length: 4 }, (_, bar) => ({
        id: `voice${vi}n${bar}`,
        time: bar * 8,
        duration: 8,
        pitch:
          vi === 1
            ? { step: ["D", "F", "E", "D"][bar], octave: 4, alter: 0 }
            : vi === 0 && bar === 1
              ? { step: "D", octave: 5, alter: 0 }
              : null,
        tieStop: vi === 0 && bar === 1,
      })),
    })),
  };
  await page.addInitScript(
    (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
    draft,
  );
  await page.goto("/");
  const highlights = page.locator(".measure-highlight");
  await expect(highlights.first()).toBeVisible();
  await expect(
    page.locator('.measure-highlight:not([data-voice="voice0"])'),
  ).toHaveCount(0);
  const highlight = page.locator(
    '.measure-highlight[data-measure="2"][data-voice="voice0"]',
  );
  await expect(highlight).toHaveAttribute("data-severity", "error");
  await expect(highlight).toHaveAttribute("rx", "12");
  expect(await highlight.getAttribute("filter")).toBeNull();
  const affected = await highlight.boundingBox();
  const otherVoice = await page.locator('[data-note="voice1n1"]').boundingBox();
  expect(affected!.y + affected!.height).toBeLessThan(otherVoice!.y);
  await expect(page.locator('[data-note="voice0n0"]')).toHaveAttribute(
    "rx",
    "12",
  );
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    expect(await highlight.evaluate((e) => getComputedStyle(e).fill)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await page
      .locator(".score-scroll")
      .screenshot({ path: `test-results/voice-feedback-${theme}.png` });
  }
});
test("ledger lines above and below the staff follow theme and feedback colors; natural cancellations are engraved", async ({
  page,
}) => {
  await page.addInitScript(
    (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
    score,
  );
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await expect(page.locator(".feedback-group.error h3")).toContainText(
    "Rule violations",
  );
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    for (const [id, count] of [
      ["low-sharp", 1],
      ["low-natural", 1],
      ["high", 1],
      ["higher", 2],
    ] as const) {
      const note = page.locator(`[id="vf-score-note-${id}"]`);
      await expect(note).toBeVisible();
      const lines = note.locator(":scope > path");
      await expect(lines).toHaveCount(count);
      for (const line of await lines.all()) {
        expect(await line.evaluate((e) => getComputedStyle(e).stroke)).toBe(
          await note.evaluate((e) => getComputedStyle(e).stroke),
        );
        expect(await line.evaluate((e) => getComputedStyle(e).stroke)).not.toBe(
          "rgb(68, 68, 68)",
        );
      }
    }
    await expect(
      page.locator('[id="vf-score-note-low-natural"]'),
    ).toContainText("\uE261");
    await page.screenshot({
      path: `test-results/ledger-${theme}.png`,
      fullPage: true,
    });
  }
  const before = await page.evaluate(() =>
    localStorage.getItem("gradus-recovery"),
  );
  for (const id of ["final", "low-natural"]) {
    const slot = page.locator(`[data-note="${id}"]`);
    await slot.focus();
    await slot.press("Enter");
  }
  expect(
    await page.evaluate(() => localStorage.getItem("gradus-recovery")),
  ).toBe(before);
});
