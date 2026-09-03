import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
  test.skip(test.info().project.name === "mobile", "Stacking gate uses the desktop CSS-pixel browser profile.");
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

test("captures the approved Editorial Strength baselines in CSS-pixel viewports", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Baselines are 72-DPI CSS-pixel captures, not device-pixel iPhone captures.");

  for (const baseline of [
    { expected: "editorial-strength-desktop-desktop-win32.png", viewport: { width: 1440, height: 900 } },
    { expected: "editorial-strength-mobile-mobile-win32.png", viewport: { width: 390, height: 844 } },
  ]) {
    await page.setViewportSize(baseline.viewport);
    await page.goto("/");
    const actualScreenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
    await testInfo.attach(`${baseline.expected}-actual`, {
      body: actualScreenshot,
      contentType: "image/png",
    });
    const expectedScreenshot = await readFile(new URL(`./visual.spec.ts-snapshots/${baseline.expected}`, import.meta.url));
    const [actual, expected] = await Promise.all([
      sharp(actualScreenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(expectedScreenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);

    expect(actual.info).toMatchObject({
      channels: expected.info.channels,
      height: expected.info.height,
      width: expected.info.width,
    });
    let mismatchedPixels = 0;
    for (let index = 0; index < actual.data.length; index += actual.info.channels) {
      const hasVisibleDifference = [0, 1, 2].some((channel) =>
        Math.abs(actual.data[index + channel] - expected.data[index + channel]) > 16,
      );
      if (hasVisibleDifference) {
        mismatchedPixels += 1;
      }
    }
    const totalPixels = actual.info.width * actual.info.height;
    expect(mismatchedPixels / totalPixels, `${baseline.expected} visible mismatch ratio`).toBeLessThan(0.003);
  }

  await testInfo.attach("landing-viewport", {
    body: await page.screenshot({ fullPage: false, animations: "disabled" }),
    contentType: "image/png",
  });
});
