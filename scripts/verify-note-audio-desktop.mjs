import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const data = await fs.mkdtemp(path.join(os.tmpdir(), "gradus-note-audio-"));
const app = await electron.launch({
  executablePath: path.resolve("release/mac-arm64/Gradus ad Parnassum.app/Contents/MacOS/Gradus ad Parnassum"),
  env: { ...process.env, GRADUS_DESKTOP_DATA: data },
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".engraving svg").waitFor();
  await page.evaluate(() => {
    window.__noteAudio = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      // Ignore Tone's silent clock and initialization buffers.
      if (this.buffer?.duration > 0.1) {
        window.__noteAudio.push({
          duration: this.buffer.duration,
          rate: this.playbackRate.value,
          state: this.context.state,
        });
      }
      return start.apply(this, args);
    };
  });
  await page.locator('[data-note="v1n0"]').click();
  await page.keyboard.press("a");
  await page.waitForFunction(() => window.__noteAudio.length > 0);
  const first = await page.evaluate(() => window.__noteAudio);
  assert.equal(first.length, 1, "One placed note should start one sample");
  assert.equal(first[0].state, "running", "Audio context must be running");
  await page.keyboard.press("b");
  await page.waitForFunction(() => window.__noteAudio.length === 2);
  await page.getByRole("button", { name: "Playback & display", exact: true }).click();
  await page.getByLabel("Instrument", { exact: true }).selectOption("violin");
  await page.locator('[data-note="v1n0"]').click();
  await page.keyboard.press("c");
  await page.waitForFunction(() => window.__noteAudio.length === 3);
  assert.equal(await page.getByRole("button", { name: "Stop playback", exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ desktop: "passed", sampleStarts: await page.evaluate(() => window.__noteAudio), instrumentSwitch: "passed" }));
} finally {
  await app.close();
}
