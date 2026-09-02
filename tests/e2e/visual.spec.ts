import { expect, test } from "@playwright/test";

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
