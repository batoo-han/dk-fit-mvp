import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("renders an opaque hero portrait without the Next development overlay", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const screenshot = await page.screenshot({ animations: "disabled" });
  const { data, info } = await sharp(screenshot).raw().toBuffer({ resolveWithObject: true });
  const pixelOffset = (400 * info.width + 820) * info.channels;
  const [red, green, blue] = data.subarray(pixelOffset, pixelOffset + 3);

  // This point sits where the large burgundy FIT used to bleed through the trainer's torso.
  expect(Math.abs(red - green)).toBeLessThanOrEqual(12);
  expect(Math.abs(red - blue)).toBeLessThanOrEqual(12);
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
});

test("keeps the FIT decoration behind the hero portrait", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const stacking = await page.locator('section[aria-labelledby="hero-title"]').evaluate((hero) => {
    const word = hero.querySelector<HTMLElement>('p[aria-hidden="true"]');
    const image = hero.querySelector<HTMLElement>('img[alt="Тренер D&K Fit в спортивной одежде"]');

    if (!word || !image) {
      throw new Error("Hero decoration or portrait is missing");
    }

    return {
      imageZIndex: Number(window.getComputedStyle(image).zIndex),
      wordZIndex: Number(window.getComputedStyle(word).zIndex),
    };
  });

  expect(stacking.wordZIndex).toBeLessThan(stacking.imageZIndex);
});

test("captures the approved Editorial Strength baseline at each viewport", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "mobile";
  await page.setViewportSize(isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.goto("/");

  await expect(page).toHaveScreenshot(`editorial-strength-${isMobile ? "mobile" : "desktop"}.png`, {
    fullPage: true,
    animations: "disabled",
  });

  await testInfo.attach("landing-viewport", {
    body: await page.screenshot({ fullPage: false, animations: "disabled" }),
    contentType: "image/png",
  });
});
