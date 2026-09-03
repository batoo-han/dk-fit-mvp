import { expect, type Page } from "@playwright/test";

export async function waitForClientReady(page: Page): Promise<void> {
  // A trusted focus interaction asks React to hydrate this boundary. Playwright's
  // fill() can otherwise update the SSR DOM before React owns its submit handler.
  await page.getByLabel("Имя").click();
  await expect(
    page.locator('form[data-client-ready="true"]'),
    "React must mount the form before E2E fills or submits it",
  ).toBeVisible();
}
