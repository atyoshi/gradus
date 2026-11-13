import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const data = await fs.mkdtemp(path.join(os.tmpdir(), "gradus-flicker-"));
const app = await electron.launch({
  executablePath: path.resolve(
    "release/mac-arm64/Gradus ad Parnassum.app/Contents/MacOS/Gradus ad Parnassum",
  ),
  env: { ...process.env, GRADUS_DESKTOP_DATA: data },
});
try {
  const page = await app.firstWindow();
  await page.locator(".analysis-panel").waitFor();
  await page
    .locator(".score-scroll")
    .evaluate((el) => el.focus({ preventScroll: true }));
  await page.evaluate(() => {
    window.scrollTo(0, 200);
    window.__stability = { removed: 0, positions: [] };
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.removedNodes) {
          if (
            node instanceof Element &&
            (node.matches(".analysis-panel") ||
              node.querySelector(".analysis-panel"))
          )
            window.__stability.removed++;
        }
    }).observe(document.querySelector(".workspace"), {
      childList: true,
      subtree: true,
    });
    const sample = () => {
      window.__stability.positions.push(window.scrollY);
      if (window.__stability.positions.length < 120)
        requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  for (const key of ["a", "b", "c"]) await page.keyboard.press(key);
  await page.waitForFunction(() => window.__stability.positions.length === 120);
  const result = await page.evaluate(() => window.__stability);
  assert.equal(result.removed, 0, "Review panel must remain mounted");
  assert.ok(
    Math.max(...result.positions) - Math.min(...result.positions) <= 1,
    "Page must remain steady while scrolled",
  );
  await fs.mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/desktop-scrolled.png" });
  const targetId = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("gradus-recovery")).voices.find(
        (v) => !v.locked,
      ).notes[0].id,
  );
  const glyphs = (el) =>
    Array.from(el.querySelectorAll("text")).map((t) => t.textContent);
  for (const duration of [8, 6, 4, 3, 2, 1]) {
    await page
      .getByLabel("Note duration", { exact: true })
      .selectOption(String(duration));
    await page
      .getByRole("button", {
        name: duration === 1 ? "Flat" : "Sharp",
        exact: true,
      })
      .click();
    const slot = page.locator(`[data-note="${targetId}"]`);
    await page.locator(".score-scroll").scrollIntoViewIfNeeded();
    await slot.hover();
    const preview = page.locator(".pitch-preview");
    await preview.locator(".vf-notehead").waitFor();
    assert.equal(
      await preview.getAttribute("data-preview-duration"),
      String(duration),
    );
    const before = await preview.evaluate(glyphs);
    if (duration === 1)
      await page.screenshot({
        path: "test-results/desktop-preview.png",
        fullPage: true,
      });
    await slot.click();
    const committed = page.locator(`[id="vf-score-note-${targetId}"]`);
    assert.deepEqual(
      await committed.evaluate(glyphs),
      before,
      `Preview glyphs for duration ${duration}`,
    );
  }
  for (const name of ["Flat", "Natural", "Sharp"]) {
    const height = await page
      .getByRole("button", { name, exact: true })
      .locator("svg")
      .evaluate((svg) => {
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.font = "32px Bravura";
        const ink = ctx.measureText(svg.querySelector("text").textContent);
        return (
          ((ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent) * 24) /
          svg.viewBox.baseVal.height
        );
      });
    assert.ok(height > 16, `${name} icon must have readable ink size`);
  }
  console.log(
    JSON.stringify({
      desktop: "passed",
      previewDurations: [8, 6, 4, 3, 2, 1],
      accidentalGlyphs: "passed",
      reviewRemovals: result.removed,
      scrollRange: [
        Math.min(...result.positions),
        Math.max(...result.positions),
      ],
    }),
  );
} finally {
  await app.close();
}
