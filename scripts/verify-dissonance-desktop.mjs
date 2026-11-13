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
  await page.evaluate(() => {
    const score = JSON.parse(localStorage.getItem("gradus-recovery"));
    score.species = 2;
    score.bars = 4;
    score.mode = "Dorian";
    score.clefs = ["treble", "treble", "bass"];
    score.voices = [0, 1, 2].map((vi) => ({
      id: `regression${vi}`,
      name: `Voice ${vi + 1}`,
      locked: vi === 1,
      notes: Array.from({ length: vi === 0 ? 8 : 4 }, (_, i) => ({
        id: `regression${vi}n${i}`,
        time: i * (vi === 0 ? 4 : 8),
        duration: vi === 0 ? 4 : 8,
        pitch:
          vi === 0
            ? i < 3
              ? { step: ["F", "E", "D"][i], octave: 5, alter: 0 }
              : null
            : vi === 1
              ? { step: i === 1 ? "F" : "D", octave: 4, alter: 0 }
              : i < 2
                ? {
                    step: i === 0 ? "D" : "A",
                    octave: i === 0 ? 3 : 2,
                    alter: 0,
                  }
                : null,
      })),
    }));
    localStorage.setItem("gradus-recovery", JSON.stringify(score));
  });
  await page.reload();
  for (const id of ["regression0n2", "regression2n1"]) {
    const note = page.locator(`[id="vf-score-note-${id}"] .vf-notehead`);
    await note.waitFor();
    assert.equal(
      await note.evaluate((e) => getComputedStyle(e).fill),
      await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--error)";
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }),
      `${id} must be red before the following half note is written`,
    );
  }
  console.log("Desktop downbeat fourth: both notes red, passed");
} finally {
  await app.close();
}
