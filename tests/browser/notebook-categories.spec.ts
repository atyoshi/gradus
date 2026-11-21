import { expect, test } from "@playwright/test";

test("notebook groups saved scores by species, mode, voices and saved date", async ({ page, request }) => {
  for (const [id, species, mode, count] of [["category-a", 2, "Dorian", 2], ["category-b", 3, "Lydian", 3]] as const) {
    const voices = Array.from({ length: count }, (_, i) => ({ id: `v${i}`, name: `Voice ${i}`, locked: i > 0, notes: [{ id: `n${i}`, time: 0, duration: 8, pitch: null }] }));
    const response = await request.post("/api/library", { data: { version: 1, id, title: id, species, mode, bars: 1, voices } });
    expect(response.ok()).toBeTruthy();
  }
  const rows = await (await request.get("/api/library")).json();
  expect(rows.find((s: { id: string }) => s.id === "category-a").libraryUpdatedAt).toBeTruthy();
  await page.goto("/");
  await page.getByRole("button", { name: /Your notebook/ }).click();
  const group = page.getByLabel("Group notebook by");
  for (const [value, heading] of [["species", "Species 2"], ["mode", "Dorian"], ["voices", "2 voices"], ["date", "Saved"]]) {
    await group.selectOption(value);
    const section = page.locator(".notebook-group").filter({ has: page.getByRole("heading", { name: new RegExp(heading) }) });
    await expect(section.getByRole("button", { name: /category-a/ })).toBeVisible();
  }
});
