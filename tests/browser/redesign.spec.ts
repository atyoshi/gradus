import { test, expect, type Page } from "@playwright/test";
import { type Score, pitch } from "../../src/model";
import { emptyPattern } from "../../src/editor";
const fixture = (): Score => ({
  version: 1,
  id: "redesign-browser",
  title: "Fourth species editing",
  species: 4,
  mode: "Dorian",
  bars: 4,
  path: {
    studyId: "suspension-fixture",
    species: 4,
    voices: 2,
    mode: "Dorian",
  },
  clefs: ["treble", "treble"],
  voices: [
    {
      id: "cp",
      name: "Counterpoint",
      locked: false,
      species: 4,
      notes: [35, 36, 36, 35, 34, 33, 32].map((d, i) => ({
        id: `cp${i}`,
        time: i * 4,
        duration: i === 6 ? 8 : 4,
        pitch: pitch(d),
      })),
    },
    {
      id: "cf",
      name: "Cantus",
      locked: true,
      species: 1,
      notes: [31, 30, 29, 28].map((d, i) => ({
        id: `cf${i}`,
        time: i * 8,
        duration: 8,
        pitch: pitch(d),
      })),
    },
  ],
});
const draft = (page: Page): Promise<Score> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("gradus-recovery")!));
async function recover(page: Page, s = fixture()) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("redesign-seeded")) {
      localStorage.setItem("gradus-recovery", JSON.stringify(s));
      sessionStorage.setItem("redesign-seeded", "true");
    }
  }, s);
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
}
async function select(page: Page, id: string) {
  const slot = page.locator(`[data-note="${id}"]`);
  await slot.focus();
  await slot.press("Enter");
}
test("fourth-species mouse and keyboard entry automatically tie later bars and survive undo and reload", async ({
  page,
}) => {
  const s = fixture();
  s.bars = 6;
  s.voices[0].notes = emptyPattern("cp", 6, 2);
  s.voices[1].notes = emptyPattern("cf", 6, 1).map((n) => ({
    ...n,
    pitch: pitch(28),
  }));
  await recover(page, s);
  const before = await draft(page);
  // Bar three, second beat: mouse entry into a source rhythm without a tie.
  await page.locator('[data-note="cpn20"]').click();
  const entered = await draft(page);
  const pair = entered.voices[0].notes.filter((n) => [20, 24].includes(n.time));
  expect(pair[0].tieStart).toBe(true);
  expect(pair[1].tieStop).toBe(true);
  expect(pair[0].pitch).not.toBeNull();
  expect(pair[1].pitch).toEqual(pair[0].pitch);
  await expect(page.locator(".vf-stavetie")).toHaveCount(1);
  await page.getByTitle("Undo", { exact: true }).click();
  expect(await draft(page)).toEqual(before);
  await page.getByTitle("Redo", { exact: true }).click();
  expect(await draft(page)).toEqual(entered);
  // Bar four: keyboard entry follows the same operation.
  await select(page, "cpn28");
  await page.keyboard.press("a");
  const saved = await draft(page);
  const nextPair = saved.voices[0].notes.filter((n) =>
    [28, 32].includes(n.time),
  );
  expect(nextPair[0].tieStart).toBe(true);
  expect(nextPair[1].tieStop).toBe(true);
  expect(nextPair[1].pitch).toEqual(nextPair[0].pitch);
  await expect(page.locator(".vf-stavetie")).toHaveCount(2);
  expect(saved.voices[1]).toEqual(before.voices[1]);
  await expect
    .poll(async () =>
      (await (await page.request.get("/api/library")).json()).find(
        (s: Score) => s.id === saved.id,
      ),
    )
    .toEqual(saved);
  await page.reload();
  await expect(page.locator(".vf-stavetie")).toHaveCount(2);
  expect(await draft(page)).toEqual(saved);
});
test("guided tie editing is one undoable change, updates connected pitches and survives saving", async ({
  page,
}) => {
  await recover(page);
  await select(page, "cp1");
  await expect(
    page.getByLabel("Note duration", { exact: true }),
  ).toBeDisabled();
  const before = await draft(page);
  await page.getByRole("button", { name: "Add tie", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove tie", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await draft(page)).voices[0].notes[2].tieStop).toBe(true);
  await page.getByTitle("Undo", { exact: true }).click();
  expect(await draft(page)).toEqual(before);
  await page.getByTitle("Redo", { exact: true }).click();
  await select(page, "cp2");
  await page.getByRole("button", { name: "Raise pitch", exact: true }).click();
  const edited = await draft(page);
  expect(edited.voices[0].notes[1].pitch).toEqual(
    edited.voices[0].notes[2].pitch,
  );
  expect(edited.voices[0].notes[1].pitch).not.toEqual(
    before.voices[0].notes[1].pitch,
  );
  expect(edited.voices[1]).toEqual(before.voices[1]);
  await expect
    .poll(async () =>
      (await page.request.get("/api/library"))
        .json()
        .then((xs: Score[]) => xs.find((s) => s.id === edited.id)),
    )
    .toEqual(edited);
  await page.reload();
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  expect(await draft(page)).toEqual(edited);
  await select(page, "cp1");
  await expect(
    page.getByRole("button", { name: "Remove tie", exact: true }),
  ).toBeEnabled();
});
test("green staff candidates are keyboard selectable and stale selections are cleared", async ({
  page,
}) => {
  const s = fixture();
  s.path = undefined;
  s.species = 1;
  s.voices[0].species = 1;
  s.voices[0].notes = [0, 8, 16, 24].map((time, i) => ({
    id: `cp${i}`,
    time,
    duration: 8,
    pitch: null,
  }));
  await recover(page, s);
  await page.getByRole("button", { name: "Pitch hints", exact: true }).click();
  await select(page, "cp0");
  const candidates = page.locator('.candidate-note[data-candidate-for="cp0"]');
  await expect(candidates.first()).toBeVisible();
  const chosen = candidates.first(),
    value = await chosen.getAttribute("data-candidate-pitch");
  const before = await draft(page);
  await chosen.focus();
  await chosen.press("Enter");
  await expect(page.locator('[data-note="cp0"]')).toHaveAttribute(
    "aria-label",
    new RegExp(value!),
  );
  expect(await draft(page)).not.toEqual(before);
  await select(page, "cp1");
  await select(page, "cp2");
  await expect(
    page.locator('.candidate-note:not([data-candidate-for="cp2"])'),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Pitch hints", exact: true }).click();
  await expect(page.locator(".candidate-note")).toHaveCount(0);
});
test("large controls, independent score scrolling and both themes at all zoom levels", async ({
  page,
}) => {
  await recover(page);
  expect(
    await page.locator("body").evaluate((e) => getComputedStyle(e).fontSize),
  ).toBe("16px");
  await expect(page.getByLabel("Score zoom")).toHaveValue("125");
  for (const label of [
    "Raise pitch",
    "Lower pitch",
    "Flat",
    "Natural",
    "Sharp",
  ]) {
    const box = (await page
      .getByRole("button", { name: label, exact: true })
      .boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const scroll = page.locator(".score-scroll");
  expect((await scroll.boundingBox())!.height).toBeGreaterThanOrEqual(340);
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    for (const z of [100, 125, 150, 175, 200]) {
      await page.getByLabel("Score zoom").selectOption(String(z));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByLabel("Score zoom").selectOption("125");
    await page.screenshot({
      path: `test-results/redesign-desktop-${theme}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await scroll.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/redesign-mobile-${theme}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1512, height: 1100 });
  }
});
test("extreme registers stay inside the score and feedback selection exposes the diagnosed event", async ({
  page,
}) => {
  const s = fixture();
  s.path = undefined;
  s.voices[0].notes[0].pitch = pitch(56); // C8
  s.voices[0].notes[1].pitch = pitch(7); // C1
  s.voices.push({
    ...structuredClone(s.voices[0]),
    id: "inner",
    name: "Inner",
    notes: s.voices[0].notes.map((n) => ({
      ...n,
      id: "inner" + n.id,
      pitch: pitch(28),
    })),
  });
  s.clefs = ["treble", "treble", "bass"];
  await recover(page, s);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const svg = document
          .querySelector(".engraving svg")
          ?.getBoundingClientRect();
        return ["cp0", "cp1"].every((id) => {
          const note = document.getElementById(`vf-score-note-${id}`);
          if (!svg || !note) return false;
          // SVG text boxes include the whole music font's ascender/descender,
          // not just the notehead ink. Check the engraved paths and head baseline.
          const paths = Array.from(note.querySelectorAll("path")).map((p) =>
            p.getBoundingClientRect(),
          );
          const head = note.querySelector<SVGTextElement>(".vf-notehead text");
          const matrix = head?.getScreenCTM();
          if (!head || !matrix || !paths.length) return false;
          const point = new DOMPoint(
            +head.getAttribute("x")!,
            +head.getAttribute("y")!,
          ).matrixTransform(matrix);
          return (
            point.y - 8 >= svg.top &&
            point.y + 8 <= svg.bottom &&
            paths.every((p) => p.top >= svg.top && p.bottom <= svg.bottom)
          );
        });
      }),
    )
    .toBe(true);
  const issue = page.locator(".feedback-group.error .finding").first();
  await issue.click();
  await expect(page.locator(".selected-finding").first()).toBeVisible();
  await expect(
    page.locator(".finding-item .finding-details").first(),
  ).toContainText("bar");
});

test("clear line is undoable, preserves cantus and resets assigned rests/ties through save and reload", async ({
  page,
}) => {
  await recover(page);
  const before = await draft(page);
  await page.getByRole("button", { name: "Clear line", exact: true }).click();
  const cleared = await draft(page);
  expect(cleared.id).toBe(before.id);
  expect(cleared.voices[1]).toEqual(before.voices[1]);
  expect(cleared.voices[0].notes.every((n) => n.pitch === null)).toBe(true);
  expect(cleared.voices[0].notes[0].rest).toBe(true);
  expect(cleared.voices[0].notes[1].tieStart).toBe(true);
  await expect(
    page.getByRole("button", { name: "Clear line", exact: true }),
  ).toBeDisabled();
  await page.getByTitle("Undo", { exact: true }).click();
  expect(await draft(page)).toEqual(before);
  await page.getByTitle("Redo", { exact: true }).click();
  expect(await draft(page)).toEqual(cleared);
  await expect
    .poll(async () =>
      (await (await page.request.get("/api/library")).json()).find(
        (s: Score) => s.id === cleared.id,
      ),
    )
    .toEqual(cleared);
  await page.reload();
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  expect(await draft(page)).toEqual(cleared);
  await select(page, "cf0");
  await expect(
    page.getByRole("button", { name: "Clear line", exact: true }),
  ).toBeDisabled();
});

test("forward hints preserve existing pitches, accidental selection on an empty slot does not write music", async ({
  page,
}) => {
  const s = fixture();
  s.path = undefined;
  s.species = 1;
  s.voices[0].species = 1;
  s.voices[0].notes = [0, 8, 16, 24].map((time, i) => ({
    id: `cp${i}`,
    time,
    duration: 8,
    pitch: i === 0 ? pitch(38) : null,
  }));
  await recover(page, s);
  await page.getByRole("button", { name: "Pitch hints", exact: true }).click();
  await select(page, "cp0");
  await expect(page.locator(".candidate-note").first()).toHaveAttribute(
    "data-candidate-for",
    "cp1",
  );
  const before = await draft(page);
  await page.locator(".candidate-note").first().focus();
  await page.locator(".candidate-note").first().press("Enter");
  expect((await draft(page)).voices[0].notes[0]).toEqual(
    before.voices[0].notes[0],
  );
  expect((await draft(page)).voices[0].notes[1].pitch).not.toBeNull();
  await expect(page.locator('[data-note="cp2"]')).toHaveAttribute(
    "fill",
    "var(--selection)",
  );
  const entered = await draft(page);
  await page.getByRole("button", { name: "Sharp", exact: true }).click();
  expect(await draft(page)).toEqual(entered);
  await expect(
    page.getByRole("button", { name: "Sharp", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await select(page, "cp2");
  await page.keyboard.press("c");
  expect((await draft(page)).voices[0].notes[2].pitch?.alter).toBe(1);
});

test("compact score, controls and open feedback fit desktop, with feedback before secondary tools on narrow screens", async ({
  page,
}) => {
  await recover(page);
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [768, 1024],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      for (const name of ["↑ Import MusicXML", "Export MusicXML ↓"]) {
        const action = page.getByRole("button", { name, exact: true });
        await expect(action).toHaveCount(1);
        const box = (await action.boundingBox())!;
        expect(box.y + box.height).toBeLessThan(
          (await page.locator(".score-card").boundingBox())!.y,
        );
      }
      const toolbar = (await page.locator(".note-toolbar").boundingBox())!;
      const feedback = (await page.locator(".feedback").boundingBox())!;
      const score = (await page.locator(".score-card").boundingBox())!;
      const secondary = (await page.locator(".score-secondary").boundingBox())!;
      if (width >= 1180) {
        // Group labels may put the toolbar below the fold on short windows.
        expect(toolbar.height).toBeLessThan(320);
        expect(feedback.x).toBeGreaterThan(score.x + score.width);
        const analysisBox = (await page
          .locator(".analysis-panel")
          .boundingBox())!;
        expect(analysisBox.y).toBeGreaterThanOrEqual(score.y + score.height);
        expect(analysisBox.width).toBeGreaterThan(feedback.width);
        const analysisSection = (await page
          .locator(".score-analysis")
          .boundingBox())!;
        await expect(page.locator(".feedback .strengths")).toHaveCount(0);
        await expect(page.locator(".score-secondary .help")).toBeVisible();

        expect(await page.locator(".feedback .analysis-panel").count()).toBe(0);
        const explanation = (await page
          .locator(".feedback .finding-body > p")
          .first()
          .boundingBox())!;
        expect(explanation.y + explanation.height).toBeLessThan(height);
      } else {
        expect(feedback.y).toBeGreaterThanOrEqual(
          secondary.y + secondary.height,
        );
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const name of [
        "Flat",
        "Natural",
        "Sharp",
        "Raise pitch",
        "Lower pitch",
      ]) {
        const button = page.getByRole("button", { name, exact: true });
        const b = (await button.boundingBox())!,
          icon = (await button.locator("svg").boundingBox())!;
        expect(
          Math.abs(b.x + b.width / 2 - icon.x - icon.width / 2),
        ).toBeLessThan(1);
        expect(
          Math.abs(b.y + b.height / 2 - icon.y - icon.height / 2),
        ).toBeLessThan(1);
      }
      await page.screenshot({
        path: `test-results/refinement-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  }
});

test("fast tempos save and play, stale candidate responses cannot restore an old target", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      slow = new Set<number>();
      postMessage(data: any) {
        if (data.type === "candidates" && data.noteId === "cp0")
          this.slow.add(data.id);
        super.postMessage(data);
      }
      set onmessage(fn: ((this: Worker, ev: MessageEvent) => any) | null) {
        super.onmessage = (e) => {
          if (this.slow.has(e.data.id))
            setTimeout(() => fn?.call(this, e), 800);
          else fn?.call(this, e);
        };
      }
    };
  });
  const s = fixture();
  s.species = 1;
  s.voices[0].species = 1;
  s.path = undefined;
  s.voices[0].notes = [0, 8, 16, 24].map((time, i) => ({
    id: `cp${i}`,
    time,
    duration: 8,
    pitch: null,
  }));
  await recover(page, s);
  await page.getByRole("button", { name: "Pitch hints", exact: true }).click();
  await select(page, "cp2");
  await expect(page.locator(".candidate-note").first()).toHaveAttribute(
    "data-candidate-for",
    "cp2",
  );
  await page.waitForTimeout(1000); // Let the deliberately delayed old response arrive.
  await expect(
    page.locator('.candidate-note:not([data-candidate-for="cp2"])'),
  ).toHaveCount(0);
  for (const bpm of [300, 400]) {
    await page.getByLabel("Tempo", { exact: true }).fill(String(bpm));
    await page.getByLabel("Tempo", { exact: true }).press("Enter");
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/settings")).json()).tempo,
      )
      .toBe(bpm);
    await page.getByRole("button", { name: "Play score", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Stop playback", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Stop playback", exact: true })
      .click();
  }
  await page.reload();
  await expect(page.getByLabel("Tempo", { exact: true })).toHaveValue("400");
});

test("empty lower voices use bass clef with space to enter E2; per-voice clefs preserve notes", async ({
  page,
}) => {
  const s = fixture();
  s.path = undefined;
  s.clefs = undefined;
  s.voices.reverse();
  s.voices[1].notes.forEach((n) => (n.pitch = null));
  await recover(page, s);
  await expect(page.locator(".engraving svg")).toHaveAttribute(
    "data-clefs",
    "treble,bass",
  );

  const slot = page.locator('[data-note="cp0"]');
  let found = false;
  await expect(slot).toBeVisible();
  await slot.scrollIntoViewIfNeeded();
  const box = (await slot.boundingBox())!;
  for (let y = box.height - 5; y > 0; y -= 5) {
    await page.mouse.move(0, 0);
    await slot.hover({ position: { x: box.width / 2, y } });
    if (
      (await page
        .locator("[data-preview-pitch]")
        .evaluateAll((es) => es[0]?.getAttribute("data-preview-pitch"))) ===
      "E2"
    ) {
      await slot.click({ position: { x: box.width / 2, y } });
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
  await expect(slot).toHaveAttribute("aria-label", /E2/);
  const before = (await draft(page)).voices;
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  await page
    .getByLabel("Clef for Counterpoint", { exact: true })
    .selectOption("treble");
  await expect(page.locator(".engraving svg")).toHaveAttribute(
    "data-clefs",
    "treble,treble",
  );
  expect((await draft(page)).voices).toEqual(before);
  await page
    .getByLabel("Clef for Counterpoint", { exact: true })
    .selectOption("bass");
  await expect(page.locator(".engraving svg")).toHaveAttribute(
    "data-clefs",
    "treble,bass",
  );
  expect((await draft(page)).voices).toEqual(before);
});

test("placement label shows readable note and interval in both themes and all zoom levels without changing the draft", async ({
  page,
}) => {
  await recover(page);

  const before = await draft(page);
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance").selectOption(theme);
    for (const zoom of ["100", "125", "150", "175", "200"]) {
      await page.getByLabel("Score zoom").selectOption(zoom);
      await page.locator('[data-note="cp0"]').hover();
      const tooltip = page.getByRole("tooltip", { name: "Note placement" });
      await expect(tooltip).toBeVisible();
      const proposed = await page
        .locator("[data-preview-pitch]")
        .getAttribute("data-preview-pitch");
      await expect(tooltip.locator("strong")).toHaveText(proposed!);
      await expect(tooltip.locator("span")).toContainText(
        / · (\d+(st|nd|rd|th)|unison|octave)/,
      );
      await expect(tooltip).toHaveCSS("font-size", "14px");
      await expect(tooltip).toHaveCSS("opacity", "1");
      const size = (await tooltip.boundingBox())!;
      expect(size.width).toBeLessThanOrEqual(120);
      expect(size.height).toBeLessThan(32);
      expect(
        await tooltip.evaluate((e) => getComputedStyle(e).backgroundColor),
      ).not.toBe("rgba(0, 0, 0, 0)");
      expect(await draft(page)).toEqual(before);
      if (zoom === "125")
        await page.screenshot({ path: `test-results/placement-${theme}.png` });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-note="cp0"]').hover();
  const box = (await page
    .getByRole("tooltip", { name: "Note placement" })
    .boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test("hints start off and arrow keys edit tied pairs after buttons and settings", async ({
  page,
}) => {
  await recover(page);
  await expect(
    page.getByRole("button", { name: "Pitch hints", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".candidate-note")).toHaveCount(0);
  await select(page, "cp1");
  await page.getByRole("button", { name: "Add tie", exact: true }).click();
  const before = await draft(page);
  await page.keyboard.press("ArrowUp");
  expect((await draft(page)).voices[0].notes[1].pitch).not.toEqual(
    before.voices[0].notes[1].pitch,
  );
  expect((await draft(page)).voices[0].notes[1].pitch).toEqual(
    (await draft(page)).voices[0].notes[2].pitch,
  );
  await page.keyboard.press("ArrowDown");
  expect((await draft(page)).voices).toEqual(before.voices);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-note="cp2"]')).toHaveAttribute(
    "fill",
    "var(--selection)",
  );
  await expect(
    page.getByRole("button", { name: "Add tie", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Control+ArrowUp");
  await page.keyboard.press("Control+ArrowDown");
  expect((await draft(page)).voices).toEqual(before.voices);
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  await page.getByLabel("Tempo", { exact: true }).focus();
  await page.keyboard.press("ArrowUp");
  expect((await draft(page)).voices).toEqual(before.voices);
  await page
    .getByRole("button", { name: "Close settings", exact: true })
    .click();
  await select(page, "cp1");
  await page.keyboard.press("ArrowUp");
  expect((await draft(page)).voices[0].notes[1].pitch).not.toEqual(
    before.voices[0].notes[1].pitch,
  );
});
