import { expect, test } from "@playwright/test";

/**
 * These cover the three answers the engine can give, through the interface
 * rather than through the engine's own API, because the unit tests already
 * prove the logic and what was untested was everything between it and a reader.
 *
 * The directive numbers are fixed because the corpus is committed: 2026-22310
 * puts fourteen Diamond DA 40s in scope, 2026-22780 clears the whole fleet, and
 * 2026-13162 defers to a service bulletin for every aircraft.
 */

test("a directive that affects the fleet leads with how many, and says why", async ({ page }) => {
  await page.goto("/directives/2026-22310");

  await expect(page.locator(".answer")).toContainText("14 tanesi bu direktifin kapsamında");

  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow.getByText("Kapsamda")).toBeVisible();
  // The verdict is never carried by colour alone: a word and a reason sit beside it.
  await expect(firstRow).toContainText("DA 40 modeli maddede adı geçiyor");
});

test("a directive that affects nothing says so, and shows no table", async ({ page }) => {
  await page.goto("/directives/2026-22780");

  await expect(page.locator(".answer")).toContainText("filonuzu etkilemiyor");
  // Out-of-scope aircraft stay behind a disclosure: nobody acts on a cleared
  // one. They are in the DOM, so the assertion is about visibility, not count.
  await expect(page.locator("tbody tr").first()).toBeHidden();
  await expect(page.getByText("Kapsam dışı kalan 400 uçağı göster")).toBeVisible();
});

test("an unresolvable clause reports what is missing instead of guessing", async ({ page }) => {
  await page.goto("/directives/2026-13162");

  await expect(page.locator(".answer")).toContainText("Karar verilemedi");
  await expect(page.locator("tbody tr").first()).toContainText("servis bülteni");
});

test("the evidence for a verdict is one disclosure away", async ({ page }) => {
  await page.goto("/directives/2026-22310");

  const clause = page.locator(".clause");
  await expect(clause).toBeHidden();

  await page.getByText("Bu karar nereden çıktı?").click();
  await expect(clause).toContainText("This AD applies to all Diamond Aircraft");
});

test("search narrows the list and the list links into a directive", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("searchbox").fill("Lycoming");
  await expect(page.getByText("196 direktifin 2 tanesi")).toBeVisible();

  await page.getByRole("link", { name: "2026-22785" }).click();
  await expect(page).toHaveURL(/\/directives\/2026-22785$/);
  await expect(page.getByRole("link", { name: "← Bütün direktifler" })).toBeVisible();
});

test("an unknown directive answers 404 rather than an empty page", async ({ page }) => {
  const response = await page.goto("/directives/not-a-directive");
  expect(response?.status()).toBe(404);
});
