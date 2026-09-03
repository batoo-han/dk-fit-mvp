import { expect, test, type Page, type Route } from "@playwright/test";

import { waitForClientReady } from "./helpers/client-readiness";

const telegramDeepLink = "https://t.me/test_bot?start=registered";

type LeadErrorResponse = {
  status: 422 | 429 | 503;
  body?: object;
};

async function openForm(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await waitForClientReady(page);
  await page.getByLabel("Имя").fill("Анна");
  await page.getByLabel("Телефон").fill("+7 999 123-45-67");
  await page.getByLabel("Согласие на обработку данных").check();
}

async function respond(route: Route, response: LeadErrorResponse) {
  await route.fulfill({
    body: JSON.stringify(response.body ?? {
      ok: false,
      error: { code: "EMAIL_UNAVAILABLE", requestId: "qa-request-id" },
    }),
    contentType: "application/json",
    status: response.status,
  });
}

test("submits exactly one valid request then opens the returned Telegram deep link in a new window", async ({ page }) => {
  let requests = 0;
  let payload: unknown;
  await page.route("**/api/leads", async (route) => {
    requests += 1;
    payload = route.request().postDataJSON();
    await route.fulfill({
      body: JSON.stringify({ ok: true, status: "email_accepted", telegramDeepLink }),
      contentType: "application/json",
      status: 201,
    });
  });
  await page.context().route("https://t.me/**", (route) => route.fulfill({ body: "Telegram" }));

  await openForm(page);
  const localOrigin = new URL(page.url()).origin;
  let nativeFormNavigations = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.isNavigationRequest() && request.method() === "GET" && url.origin === localOrigin && url.pathname === "/") {
      nativeFormNavigations += 1;
    }
  });
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  const telegramPage = await popupPromise;

  await expect(telegramPage).toHaveURL(telegramDeepLink);
  await expect(page).toHaveURL(/\/$/u);
  expect(requests).toBe(1);
  expect(nativeFormNavigations).toBe(0);
  expect(payload).toMatchObject({
    consent: true,
    name: "Анна",
    phone: "+7 999 123-45-67",
    website: "",
  });
});

for (const testCase of [
  {
    name: "422 validation rejection",
    response: {
      status: 422,
      body: { ok: false, error: { code: "INVALID_REQUEST", requestId: "qa-request-id", fieldErrors: { phone: ["Неверный номер"] } } },
    } satisfies LeadErrorResponse,
    expected: "Неверный номер",
  },
  { name: "429 rate limit", response: { status: 429 } satisfies LeadErrorResponse, expected: "Слишком много попыток. Попробуйте позже." },
  { name: "503 delivery outage", response: { status: 503 } satisfies LeadErrorResponse, expected: "Сервис временно недоступен. Попробуйте ещё раз позже." },
]) {
  test(`stays on the form after ${testCase.name}`, async ({ page }) => {
    await page.route("**/api/leads", (route) => respond(route, testCase.response));
    await openForm(page);

    await page.getByRole("button", { name: "Отправить заявку" }).click();

    const feedback = testCase.response.status === 422
      ? page.getByText(testCase.expected)
      : page.getByRole("status");
    await expect(feedback).toHaveText(testCase.expected);
    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByLabel("Имя")).toHaveValue("Анна");
  });
}

test("stays on the form and preserves values when the lead request is offline", async ({ page }) => {
  await page.route("**/api/leads", (route) => route.abort("failed"));
  await openForm(page);

  await page.getByRole("button", { name: "Отправить заявку" }).click();

  await expect(page.getByRole("status")).toHaveText("Не удалось отправить заявку. Проверьте подключение и повторите попытку.");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByLabel("Телефон")).toHaveValue("+7 999 123-45-67");
});

test("suppresses a double click while the first lead request is pending", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/leads", async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      body: JSON.stringify({ ok: false, error: { code: "EMAIL_UNAVAILABLE", requestId: "qa-request-id" } }),
      contentType: "application/json",
      status: 503,
    });
  });
  await openForm(page);

  await page.getByRole("button", { name: "Отправить заявку" }).dblclick();
  await expect(page.getByRole("status")).toHaveText("Сервис временно недоступен. Попробуйте ещё раз позже.");

  expect(requests).toBe(1);
});

test("closing the Telegram window after success never resubmits the completed form", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/leads", async (route) => {
    requests += 1;
    await route.fulfill({
      body: JSON.stringify({ ok: true, status: "email_accepted", telegramDeepLink }),
      contentType: "application/json",
      status: 201,
    });
  });
  await page.context().route("https://t.me/**", (route) => route.fulfill({ body: "Telegram" }));
  await openForm(page);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  const telegramPage = await popupPromise;
  await expect(telegramPage).toHaveURL(telegramDeepLink);
  await telegramPage.close();

  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByLabel("Имя")).toBeVisible();
  expect(requests).toBe(1);
});

test("completes a valid submission using keyboard-only form interaction", async ({ page }) => {
  test.skip(test.info().project.name === "mobile", "Keyboard tab-order gate runs in the desktop browser profile.");
  let requests = 0;
  await page.route("**/api/leads", async (route) => {
    requests += 1;
    await route.fulfill({
      body: JSON.stringify({ ok: false, error: { code: "EMAIL_UNAVAILABLE", requestId: "qa-request-id" } }),
      contentType: "application/json",
      status: 503,
    });
  });
  await page.goto("/", { waitUntil: "networkidle" });

  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(page.getByLabel("Имя")).toBeFocused();
  await page.keyboard.type("Анна");
  await page.keyboard.press("Tab");
  await page.keyboard.type("+79991234567");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Отправить заявку" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toHaveText("Сервис временно недоступен. Попробуйте ещё раз позже.");
  expect(requests).toBe(1);
});
