import { test, expect } from "@playwright/test";
test("notation, editing, saves, XML, and notebook", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Fux · Figure 5",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/studio.png",
    fullPage: true,
    animations: "disabled",
  });
  const first = page.locator('[data-note="v1n0"]');
  await first.click();
  await page.keyboard.press("a");
  await expect(page.getByText("Saved on this Mac")).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-note="v1n0"]')).toHaveAttribute(
    "aria-label",
    /A[34]/,
  );
  await page.getByRole("button", { name: "Sample answer" }).click();
  await expect(
    page.getByRole("button", { name: "Return to my work" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export MusicXML ↓" }).click();
  expect((await download).suggestedFilename()).toContain(".musicxml");
  await page.getByRole("button", { name: /Your notebook/ }).click();
  await expect(
    page.getByRole("heading", { name: "Keep the work." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("all species render and every source is editable without exceptions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  await page.locator(".exercise-setup > summary").click();
  for (const v of [2, 3, 4])
    for (const s of [1, 2, 3, 4, 5]) {
      if (!(await page.locator(".exercise-setup").evaluate((node: HTMLDetailsElement) => node.open)))
        await page.locator(".exercise-setup > summary").click();
      await page.getByLabel("Voices", { exact: true }).selectOption(String(v));
      await page.getByLabel("Species", { exact: true }).selectOption(String(s));
      await page.getByLabel("Mode", { exact: true }).selectOption("Dorian");
      await page.locator(".exercise").first().click();
      await expect(page.locator("svg [data-note]").first()).toBeVisible();
      await expect(page.locator(".engraving svg")).toBeVisible();
      await page
        .getByRole("button", { name: "Playback & display", exact: true })
        .click();
    }
  expect(errors).toEqual([]);
});
test("offline samples, clefs, candidate hints, and non-destructive model preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".engraving svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  await page.locator(".exercise-setup > summary").click();
  await page.getByLabel("Species", { exact: true }).selectOption("1");
  await page.getByLabel("Voices", { exact: true }).selectOption("2");
  await page.getByLabel("Mode", { exact: true }).selectOption("Dorian");
  await page
    .locator(".exercise")
    .filter({
      has: page.getByRole("heading", { name: "Fux · Figure 5", exact: true }),
    })
    .click();
  await page.locator('[data-note="v1n0"]').click();
  await page.keyboard.press("a");
  await expect(
    page.getByRole("button", { name: "Pitch hints", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Pitch hints", exact: true }).click();
  await page.locator(".candidate-panel > summary").click();
  await expect(page.locator(".candidate-panel button").first()).toBeVisible();
  await page.getByLabel("Clefs", { exact: true }).selectOption("c");
  await page.getByRole("button", { name: "Sample answer" }).click();
  await expect(
    page.getByText("Viewing a sample answer.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-note="v1n8"]')).toHaveAttribute(
    "aria-label",
    /—/,
  );
  await page
    .getByRole("button", { name: "Playback & display", exact: true })
    .click();
  await expect(page.getByLabel("Clefs", { exact: true })).toHaveValue("c");
  for (const instrument of ["piano", "cello", "violin"]) {
    await page
      .getByLabel("Instrument", { exact: true })
      .selectOption(instrument);
    await page.getByRole("button", { name: "Play score", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Stop playback", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(700);
    await page
      .getByRole("button", { name: "Stop playback", exact: true })
      .click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("backup restoration and invalid records", async ({ request }) => {
  const backup = await request.get("/api/backup");
  const body = await backup.json();
  expect(body.version).toBe(1);
  expect(body.scores.length).toBeGreaterThan(0);
  const restored = await request.post("/api/restore", { data: body });
  expect(restored.ok()).toBe(true);
  const scores = await (await request.get("/api/library")).json();
  expect(scores.length).toBe(body.scores.length);
  expect(
    (
      await request.post("/api/restore", {
        data: { version: 1, scores: [{ id: "bad" }] },
      })
    ).status(),
  ).toBe(400);
});
test("blank slots, transient pitch preview, one system, harmless selection and dark theme", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('svg[data-systems="1"]')).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await page.getByLabel("Species", { exact: true }).selectOption("1");
  await page.getByLabel("Voices", { exact: true }).selectOption("2");
  await page.getByLabel("Mode", { exact: true }).selectOption("Dorian");
  await page
    .locator(".exercise")
    .filter({
      has: page.getByRole("heading", { name: "Fux · Figure 5", exact: true }),
    })
    .click();
  const slot = page.locator('[data-note="v1n0"]');
  await expect(slot).toHaveAttribute("aria-label", /—/);
  await slot.hover();
  await expect(page.locator("[data-preview-pitch]")).toBeVisible();
  const proposed = await page
    .locator("[data-preview-pitch]")
    .getAttribute("data-preview-pitch");
  await expect(slot).toHaveAttribute("aria-label", /—/);
  await slot.click();
  await expect(slot).toHaveAttribute("aria-label", new RegExp(proposed!));
  await expect(
    page.getByRole("button", { name: "Rest", exact: true }),
  ).toBeDisabled();
  const before = await slot.getAttribute("aria-label");
  await slot.focus();
  await slot.press("Enter");
  expect(await slot.getAttribute("aria-label")).toBe(before);
  await page.getByLabel("Appearance").selectOption("dark");
  await page.screenshot({
    path: "test-results/studio-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Appearance").selectOption("light");
  await page.screenshot({
    path: "test-results/studio-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(page.getByLabel("Appearance")).toHaveValue("light");
  await expect(page.locator('[data-note="v1n0"]')).toHaveAttribute(
    "aria-label",
    new RegExp(proposed!),
  );
});
test("wrong pitches have neutral previews, can be committed, and can be changed by click, keyboard and drag", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('svg[data-systems="1"]')).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await page.getByLabel("Species", { exact: true }).selectOption("1");
  await page.getByLabel("Voices", { exact: true }).selectOption("2");
  await page.getByLabel("Mode", { exact: true }).selectOption("Dorian");
  await page
    .locator(".exercise")
    .filter({
      has: page.getByRole("heading", { name: "Fux · Figure 5", exact: true }),
    })
    .click();
  const slot = page.locator('[data-note="v1n0"]');
  const box = (await slot.boundingBox())!;
  let y = 0;
  for (let offset = 10; offset < box.height; offset += 5) {
    await slot.hover({ position: { x: box.width / 2, y: offset } });
    if (
      (await page
        .locator("[data-preview-pitch]")
        .getAttribute("data-preview-pitch")) === "E4"
    ) {
      y = offset;
      break;
    }
  }
  expect(y).toBeGreaterThan(0);
  const accent = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--accent)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await expect(page.locator(".pitch-preview .vf-notehead")).toHaveCSS(
    "fill",
    accent,
  );
  await expect(slot).toHaveAttribute("aria-label", /—/);
  await slot.click({ position: { x: box.width / 2, y } });
  await expect(slot).toHaveAttribute("aria-label", /E4/);
  await expect(page.locator(".finding.error").first()).toBeVisible();
  await slot.click({ position: { x: box.width / 2, y: y - 12.5 } });
  await expect(slot).toHaveAttribute("aria-label", /G4/);
  await page.keyboard.press("ArrowUp");
  await expect(slot).toHaveAttribute("aria-label", /A4/);
  const second = page.locator('[data-note="v1n8"]');
  await second.click();
  const secondBefore = await second.getAttribute("aria-label");
  await slot.hover({ position: { x: box.width / 2, y: y - 12.5 } });
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + y - 31.25, { steps: 5 });
  await page.mouse.up();
  await expect(slot).toHaveAttribute("aria-label", /C5/);
  expect(await second.getAttribute("aria-label")).toBe(secondBefore);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(slot).toHaveAttribute("aria-label", /A4/);
  await page.reload();
  await expect(slot).toHaveAttribute("aria-label", /A4/);
});
test("rule violations shade affected voice measures and improvements have their own amber group", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await expect(page.locator('svg[data-systems="1"]')).toBeVisible();
  await page.locator(".exercise-setup > summary").click();
  await page.getByLabel("Species", { exact: true }).selectOption("1");
  await page.getByLabel("Voices", { exact: true }).selectOption("2");
  await page.getByLabel("Mode", { exact: true }).selectOption("Dorian");
  await page
    .locator(".exercise")
    .filter({
      has: page.getByRole("heading", { name: "Fux · Figure 5", exact: true }),
    })
    .click();
  async function put(id: string, pitch: string) {
    const slot = page.locator(`[data-note="${id}"]`);
    let box: any;
    await expect
      .poll(async () => {
        box = await slot.boundingBox();
        return !!box;
      })
      .toBe(true);
    for (let y = 5; y < box.height; y += 5) {
      await page.mouse.move(0, 0);
      await slot.hover({ position: { x: box.width / 2, y } });
      if (
        (await page
          .locator("[data-preview-pitch]")
          .evaluateAll((es) => es[0]?.getAttribute("data-preview-pitch"))) ===
        pitch
      ) {
        await slot.click({ position: { x: box.width / 2, y } });
        await expect(slot).toHaveAttribute("aria-label", new RegExp(pitch));
        return;
      }
    }
    throw Error("Pitch outside test staff: " + pitch);
  }
  await expect(
    page.getByRole("heading", { name: /Rule violations/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Suggestions/ })).toHaveCount(
    0,
  );
  await put("v1n0", "E4");
  await expect(
    page
      .locator('.measure-highlight[data-measure="1"][data-severity="error"]')
      .first(),
  ).toBeVisible();
  await expect(
    page.locator(".feedback-group.error .finding").first(),
  ).toContainText("Bar 1");
  await expect(
    page.locator(".feedback-group.suggestion .finding.error"),
  ).toHaveCount(0);
  await put("v1n0", "A4");
  await expect(page.locator(".measure-highlight.error")).toHaveCount(0);
  await put("v1n8", "A4");
  // Three consonant repeated attacks provide genuine craft advice. Leap
  // recovery is no longer an automatic rule in the current source policy.
  await put("v1n16", "B4");
  await put("v1n24", "B4");
  await put("v1n32", "B4");
  await expect(
    page.locator(".feedback-group.suggestion .finding").first(),
  ).toBeVisible();
  await expect(
    page.locator(".measure-highlight.suggestion").first(),
  ).toBeVisible();
  await expect(page.locator(".measure-highlight.error")).toHaveCount(0);
  await expect(page.locator(".feedback-group.error")).toHaveCount(0);
  await page.getByLabel("Appearance").selectOption("dark");
  await page.screenshot({
    path: "test-results/measure-feedback-dark.png",
    fullPage: true,
    animations: "disabled",
  });
});
