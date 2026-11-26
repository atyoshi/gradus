import { test, expect, type Locator } from "@playwright/test";
import type { Score } from "../../src/model";

const draft: Score = {
  version: 1,
  id: "engraved-preview",
  title: "Preview engraving",
  species: 5,
  mode: "Dorian",
  bars: 2,
  clefs: ["treble", "bass"],
  voices: [
    {
      id: "top",
      name: "Counterpoint",
      locked: false,
      notes: [0, 8].map((time) => ({
        id: `entry${time}`,
        time,
        duration: 8,
        pitch: null,
      })),
    },
    {
      id: "cantus",
      name: "Cantus",
      locked: true,
      notes: [0, 8].map((time) => ({
        id: `cantus${time}`,
        time,
        duration: 8,
        pitch: { step: "D", octave: 3, alter: 0 },
      })),
    },
  ],
};

async function engraving(note: Locator) {
  return note.evaluate((el) => ({
    glyphs: Array.from(el.querySelectorAll("text")).map((t) => t.textContent),
    heads: el.querySelectorAll(".vf-notehead").length,
    stems: el.querySelectorAll(".vf-stem").length,
    flags: el.querySelectorAll(".vf-flag").length,
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
  }));
}

for (const value of [8, 6, 4, 3, 2, 1]) {
  test(`duration ${value} preview matches committed engraving`, async ({
    page,
  }) => {
    await page.addInitScript(
      (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
      draft,
    );
    await page.goto("/");
    const slot = page.locator('[data-note="entry0"]');
    await expect(slot).toBeVisible();
    await page
      .getByRole("group", { name: "Next note duration" })
      .locator(`button[data-duration="${value}"]`).click();
    await page.getByRole("button", { name: "Sharp", exact: true }).click();
    await page.locator(".score-scroll").scrollIntoViewIfNeeded();
    await slot.hover();
    const preview = page.locator(".pitch-preview");
    await expect(preview.locator(".vf-notehead")).toBeVisible();
    await expect(preview).toHaveAttribute(
      "data-preview-duration",
      String(value),
    );
    // Keep the cursor still long enough to catch hover/preview hit-test loops.
    await page.waitForTimeout(150);
    await expect(preview.locator(".vf-notehead")).toBeVisible();
    expect(
      await preview.evaluate((el) =>
        Array.from(el.querySelectorAll("[pointer-events]")).every(
          (child) => child.getAttribute("pointer-events") === "none",
        ),
      ),
    ).toBe(true);
    const before = await engraving(preview);
    expect(before.heads).toBe(1);
    expect(before.stems).toBe(value < 8 ? 1 : 0);
    expect(before.flags).toBe(value < 2 ? 1 : 0);
    expect(before.glyphs).toContain("\uE262");
    await page.screenshot({
      path: `test-results/preview-${value}.png`,
      fullPage: true,
    });
    await slot.click();
    const committed = page.locator('[id="vf-score-note-entry0"]');
    await expect(committed).toBeVisible();
    // React can replace the SVG between reads. Compare one complete snapshot
    // each time rather than waiting for geometry and then reading a new node.
    await expect(async () => {
      const after = await engraving(committed);
      expect(after.glyphs).toEqual(before.glyphs);
      expect(after.heads).toBe(before.heads);
      expect(after.stems).toBe(before.stems);
      expect(after.flags).toBe(before.flags);
      expect(after.width).toBeCloseTo(before.width, 0);
      expect(after.height).toBeCloseTo(before.height, 0);
    }).toPass({ timeout: 5000 });
    await expect(preview).toHaveCount(0);
  });
}

test("accidental controls use centered Bravura glyphs in both themes", async ({
  page,
}) => {
  await page.addInitScript(
    (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
    draft,
  );
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    await page.evaluate(() => document.fonts.ready);
    for (const [name, glyph] of [
      ["Flat", "\uE260"],
      ["Natural", "\uE261"],
      ["Sharp", "\uE262"],
    ]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button.locator("text")).toHaveText(glyph);
      const geometry = await button.locator("svg").evaluate((svg) => {
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.font = "32px Bravura";
        const ink = ctx.measureText(svg.querySelector("text")!.textContent!);
        const box = (svg as SVGSVGElement).viewBox.baseVal;
        return {
          x: Math.abs(
            (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2 -
              box.x -
              box.width / 2,
          ),
          y: Math.abs(
            (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2 -
              box.y -
              box.height / 2,
          ),
          inkHeight:
            ((ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent) *
              24) /
            box.height,
          family: getComputedStyle(svg.querySelector("text")!).fontFamily,
        };
      });
      expect(geometry.inkHeight).toBeGreaterThan(16);
      expect(geometry.family).toContain("Bravura");
      expect(geometry.x).toBeLessThan(1);
      expect(geometry.y).toBeLessThan(1);
    }
    await page
      .locator(".note-toolbar")
      .screenshot({ path: `test-results/accidentals-${theme}.png` });
  }
});
