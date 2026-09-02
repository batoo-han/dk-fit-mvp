import { expect, test } from "@playwright/test";

test("keeps the Editorial Strength landing within two sections without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("main > section")).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Сила становится стилем");
  await expect(page.getByRole("link", { name: "Начать персонально" })).toHaveAttribute(
    "href",
    "#lead-form",
  );

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
});
