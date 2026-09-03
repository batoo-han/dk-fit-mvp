import { describe, expect, it } from "vitest";

import { initialLeadFormState, leadFormReducer } from "../../src/features/lead-form/state";

describe("leadFormReducer", () => {
  it("moves from idle through validation to submitting", () => {
    const validating = leadFormReducer(initialLeadFormState, { type: "VALIDATE" });
    const submitting = leadFormReducer(validating, { type: "SUBMIT" });

    expect(validating.status).toBe("validating");
    expect(submitting.status).toBe("submitting");
  });

  it("keeps entered values when validation fails", () => {
    const state = leadFormReducer(
      { ...initialLeadFormState, values: { name: "Анна", phone: "", goal: "Сила", consent: false } },
      { type: "VALIDATION_ERROR", fieldErrors: { phone: "Укажите номер телефона", consent: "Необходимо согласие на обработку данных" } },
    );

    expect(state.status).toBe("validation_error");
    expect(state.values).toEqual({ name: "Анна", phone: "", goal: "Сила", consent: false });
    expect(state.fieldErrors.phone).toBe("Укажите номер телефона");
  });

  it("only enters the success path for a 201 email acceptance", () => {
    const submitted = { ...initialLeadFormState, status: "submitting" as const };
    const accepted = leadFormReducer(submitted, { type: "EMAIL_ACCEPTED", telegramDeepLink: "https://t.me/test_bot?start=registered" });
    const redirecting = leadFormReducer(accepted, { type: "REDIRECT" });

    expect(accepted.status).toBe("email_accepted");
    expect(accepted.telegramDeepLink).toBe("https://t.me/test_bot?start=registered");
    expect(redirecting.status).toBe("redirecting");
  });

  it("keeps values for rate limits and delivery errors", () => {
    const submitting = {
      ...initialLeadFormState,
      status: "submitting" as const,
      values: { name: "Анна", phone: "+7 900 000-00-00", goal: "Сила", consent: true },
    };

    const rateLimited = leadFormReducer(submitting, { type: "RATE_LIMITED" });
    const deliveryError = leadFormReducer(submitting, { type: "DELIVERY_ERROR", message: "Сервис временно недоступен. Попробуйте ещё раз позже." });

    expect(rateLimited.status).toBe("rate_limited");
    expect(rateLimited.values.name).toBe("Анна");
    expect(deliveryError.status).toBe("delivery_error");
    expect(deliveryError.values.phone).toBe("+7 900 000-00-00");
  });
});
