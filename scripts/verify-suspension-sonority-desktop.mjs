import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseKern } from "../src/model.ts";

const data = await fs.mkdtemp(path.join(os.tmpdir(), "gradus-sonority-"));
const rows = JSON.parse(await fs.readFile("public/sources/fux.json", "utf8"));
const app = await electron.launch({
  executablePath: path.resolve(
    "release/mac-arm64/Gradus ad Parnassum.app/Contents/MacOS/Gradus ad Parnassum",
  ),
  env: { ...process.env, GRADUS_DESKTOP_DATA: data },
});
try {
  const page = await app.firstWindow();
  await page.locator(".engraving svg").waitFor();
  for (const id of ["gap_141", "gap_143", "gap_144"]) {
    const score = parseKern(rows.find((row) => row.metadata.id === id));
    score.id = `sonority-test-${id}`;
    await page.evaluate(
      (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
      score,
    );
    await page.reload();
    await page.locator(".engraving svg").waitFor();
    await page.waitForFunction(
      () => !document.body.innerText.includes("Checking"),
    );
    assert.doesNotMatch(
      await page.locator(".feedback").innerText(),
      /fuller sonority|including a third or sixth/i,
      id,
    );
    if (id === "gap_144") {
      await fs.mkdir("test-results", { recursive: true });
      await page.screenshot({
        path: "test-results/desktop-suspension-sonority.png",
        fullPage: true,
      });
    }
  }
  console.log(
    "Packaged app: upper, middle and bass suspension studies have no full-sonority suggestions.",
  );
  const fourVoices = parseKern(
    rows.find((row) => row.metadata.id === "gap_193"),
  );
  await page.evaluate(
    (s) => localStorage.setItem("gradus-recovery", JSON.stringify(s)),
    fourVoices,
  );
  await page.reload();
  await page.locator(".engraving svg").waitFor();
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  assert.equal(await page.locator(".voice-setting").count(), 4);
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    for (const width of [1440, 850]) {
      await page.setViewportSize({ width, height: 1000 });
      const problem = await page
        .locator(".voice-setting")
        .evaluateAll((groups) =>
          groups.some((group) => {
            const outer = group.getBoundingClientRect();
            return Array.from(group.querySelectorAll("button, select")).some(
              (el) => {
                const r = el.getBoundingClientRect();
                return (
                  r.left < outer.left ||
                  r.right > outer.right ||
                  r.top < outer.top ||
                  r.bottom > outer.bottom
                );
              },
            );
          }),
        );
      assert.equal(problem, false, "Voice controls stay inside their groups");
      await page.screenshot({
        path: `test-results/desktop-polish-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  const mute = page.getByRole("button", { name: "Mute Voice 1", exact: true });
  await mute.click();
  assert.equal(await mute.getAttribute("aria-pressed"), "true");
  await page
    .getByRole("button", { name: "Play all voices", exact: true })
    .click();
  assert.equal(await mute.getAttribute("aria-pressed"), "false");
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear line", exact: true }).click();
  assert.equal(await page.locator(".notice").getAttribute("role"), "status");
  for (const width of [1440, 850]) {
    await page.setViewportSize({ width, height: 1000 });
    const notice = page.locator(".notice");
    const button = notice.getByRole("button", { name: "Dismiss", exact: true });
    const outer = await notice.boundingBox();
    const inner = await button.boundingBox();
    assert.ok(
      inner.y >= outer.y && inner.y + inner.height <= outer.y + outer.height,
      "Dismiss stays inside notice",
    );
    assert.ok(
      Math.abs(inner.y + inner.height / 2 - (outer.y + outer.height / 2)) <= 1,
      "Dismiss is vertically centered",
    );
  }
  await page
    .locator(".notice")
    .screenshot({ path: "test-results/desktop-notice-alignment.png" });
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  assert.equal(await page.locator(".notice").count(), 0);
  console.log(
    "Packaged app: Dismiss aligned inside notice at desktop and narrow widths; dismissal works.",
  );
} finally {
  await app.close();
}
