import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const data = await fs.mkdtemp(path.join(os.tmpdir(), "gradus-fourth-species-"));
const app = await electron.launch({
  executablePath: path.resolve(
    "release/mac-arm64/Gradus ad Parnassum.app/Contents/MacOS/Gradus ad Parnassum",
  ),
  env: { ...process.env, GRADUS_DESKTOP_DATA: data },
});
try {
  const page = await app.firstWindow();
  await page.locator(".engraving svg").waitFor();
  await page.evaluate(() => {
    const score = {
      version: 1,
      id: "desktop-fourth-species",
      title: "Fourth species automatic ties",
      species: 4,
      mode: "Dorian",
      bars: 6,
      clefs: ["treble", "bass"],
      voices: [false, true].map((locked, vi) => ({
        id: `v${vi}`,
        name: locked ? "Cantus" : "Counterpoint",
        locked,
        species: locked ? 1 : 4,
        notes: Array.from({ length: locked ? 6 : 11 }, (_, i) => ({
          id: `v${vi}n${i * (locked ? 8 : 4)}`,
          time: i * (locked ? 8 : 4),
          duration: locked || i === 10 ? 8 : 4,
          pitch: locked
            ? { step: "D", octave: 3, alter: 0 }
            : i === 5
              ? { step: "F", octave: 5, alter: 0 }
              : null,
        })),
      })),
    };
    localStorage.setItem("gradus-recovery", JSON.stringify(score));
  });
  await page.reload();
  const draft = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")));
  const before = await draft();
  await page.locator('[data-note="v0n20"]').click();
  const entered = await draft();
  const checkPair = (score, time) => {
    const a = score.voices[0].notes.find((n) => n.time === time);
    const b = score.voices[0].notes.find((n) => n.time === time + 4);
    assert.equal(a.tieStart, true);
    assert.equal(b.tieStop, true);
    assert.ok(a.pitch);
    assert.deepEqual(b.pitch, a.pitch);
  };
  checkPair(entered, 20);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.deepEqual(await draft(), before);
  await page.getByTitle("Redo", { exact: true }).click();
  assert.deepEqual(await draft(), entered);
  const slot = page.locator('[data-note="v0n28"]');
  await slot.focus();
  await slot.press("Enter");
  await page.keyboard.press("a");
  const saved = await draft();
  checkPair(saved, 20);
  checkPair(saved, 28);
  assert.deepEqual(saved.voices[1], before.voices[1]);
  await page.waitForFunction(async (id) => {
    const library = await fetch("/api/library").then((r) => r.json());
    return (
      JSON.stringify(library.find((s) => s.id === id)) ===
      localStorage.getItem("gradus-recovery")
    );
  }, saved.id);
  await page.reload();
  await page.locator(".engraving svg").waitFor();
  assert.deepEqual(await draft(), saved);
  assert.equal(await page.locator(".vf-stavetie").count(), 2);
  await fs.mkdir("test-results", { recursive: true });
  await page
    .locator(".score-scroll")
    .screenshot({ path: "test-results/desktop-fourth-species.png" });
  console.log(
    "Packaged app: automatic ties in bars 3 and 4, mouse and keyboard entry, undo/redo, save/reload passed.",
  );
} finally {
  await app.close();
}
