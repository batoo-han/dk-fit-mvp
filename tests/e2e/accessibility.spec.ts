import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("has no critical or serious axe violations on the public landing", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blockingViolations).toEqual([]);
});
