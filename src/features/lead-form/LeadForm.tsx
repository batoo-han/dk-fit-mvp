"use client";

import { useEffect, useReducer, useRef } from "react";

import { InputField, TextareaField } from "../../components/ui/Field";
import type { LeadSubmitError, LeadSubmitRequest, LeadSubmitSuccess } from "../../lib/contracts/lead";
import { landingContent } from "../../content/landing.ru";
import styles from "./LeadForm.module.css";
import { initialLeadFormState, leadFormReducer, type LeadFormValues } from "./state";
import { submitLead } from "./submit-lead";

type LeadFormProps = {
  request?: (payload: LeadSubmitRequest, idempotencyKey: string) => Promise<Response>;
};

const content = landingContent.leadForm;

export function LeadForm({ request = submitLead }: LeadFormProps) {
  const [state, dispatch] = useReducer(leadFormReducer, initialLeadFormState);
  const idempotencyKey = useRef<string | undefined>(undefined);
  const firstInvalidField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const redirectTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (redirectTimer.current !== undefined) {
      window.clearTimeout(redirectTimer.current);
    }
  }, []);

  useEffect(() => {
    if (state.status !== "email_accepted" || !state.telegramDeepLink) {
      return;
    }

    redirectTimer.current = window.setTimeout(() => {
      dispatch({ type: "REDIRECT" });
      window.location.assign(state.telegramDeepLink!);
    }, 0);
  }, [state.status, state.telegramDeepLink]);

  function update(field: keyof LeadFormValues, value: string | boolean) {
    dispatch({ type: "UPDATE", field, value });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status === "submitting" || state.status === "email_accepted" || state.status === "redirecting") {
      return;
    }

    dispatch({ type: "VALIDATE" });
    const fieldErrors = validate(state.values);
    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: "VALIDATION_ERROR", fieldErrors });
      window.requestAnimationFrame(() => firstInvalidField.current?.focus());
      return;
    }

    const key = idempotencyKey.current ?? createIdempotencyKey();
    idempotencyKey.current = key;
    dispatch({ type: "SUBMIT" });
    try {
      const response = await request(toLeadRequest(state.values), key);
      const payload = await safeJson(response);
      if (response.status === 201 && isLeadSuccess(payload)) {
        dispatch({ type: "EMAIL_ACCEPTED", telegramDeepLink: payload.telegramDeepLink });
        return;
      }

      if (response.status === 422 && isLeadError(payload)) {
        dispatch({ type: "VALIDATION_ERROR", fieldErrors: mapServerFieldErrors(payload.error.fieldErrors) });
        window.requestAnimationFrame(() => firstInvalidField.current?.focus());
        return;
      }
      if (response.status === 429) {
        dispatch({ type: "RATE_LIMITED", message: content.errors.rateLimited });
        return;
      }
      dispatch({ type: "DELIVERY_ERROR", message: content.errors.unavailable });
    } catch {
      dispatch({ type: "DELIVERY_ERROR", message: content.errors.connection });
    }
  }

  const isSubmitting = state.status === "submitting" || state.status === "email_accepted" || state.status === "redirecting";
  const message = state.status === "email_accepted" || state.status === "redirecting"
    ? content.successMessage
    : state.message;
  const messageKind = state.status === "email_accepted" || state.status === "redirecting" ? "success" : "error";

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <InputField
        autoComplete="name"
        error={state.fieldErrors.name}
        id="lead-name"
        label={content.nameLabel}
        name="name"
        onChange={(event) => update("name", event.target.value)}
        ref={(node) => { if (state.fieldErrors.name) firstInvalidField.current = node; }}
        value={state.values.name}
      />
      <InputField
        autoComplete="tel"
        error={state.fieldErrors.phone}
        id="lead-phone"
        inputMode="tel"
        label={content.phoneLabel}
        name="phone"
        onChange={(event) => update("phone", event.target.value)}
        ref={(node) => { if (!state.fieldErrors.name && state.fieldErrors.phone) firstInvalidField.current = node; }}
        type="tel"
        value={state.values.phone}
      />
      <TextareaField
        error={state.fieldErrors.goal}
        id="lead-goal"
        label={content.goalLabel}
        name="goal"
        onChange={(event) => update("goal", event.target.value)}
        ref={(node) => { if (!state.fieldErrors.name && !state.fieldErrors.phone && state.fieldErrors.goal) firstInvalidField.current = node; }}
        value={state.values.goal}
      />
      <div>
        <label className={styles.consent}>
          <input
            aria-describedby={state.fieldErrors.consent ? "lead-consent-error" : undefined}
            aria-invalid={Boolean(state.fieldErrors.consent)}
            checked={state.values.consent}
            name="consent"
            onChange={(event) => update("consent", event.target.checked)}
            ref={(node) => { if (!state.fieldErrors.name && !state.fieldErrors.phone && !state.fieldErrors.goal && state.fieldErrors.consent) firstInvalidField.current = node; }}
            type="checkbox"
          />
          <span>
            {content.consentLabel}. <a className={styles.privacy} href="/privacy">{content.privacyLinkLabel}</a>
          </span>
        </label>
        {state.fieldErrors.consent ? <p className={styles.fieldError} id="lead-consent-error">{state.fieldErrors.consent}</p> : null}
      </div>
      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="lead-website">Website</label>
        <input autoComplete="off" id="lead-website" name="website" tabIndex={-1} type="text" />
      </div>
      <button className={styles.submit} disabled={isSubmitting} type="submit">
        {isSubmitting ? "Отправляем…" : content.submitLabel}
      </button>
      <p aria-live="polite" className={styles.message} data-kind={messageKind} role="status">
        {message}
      </p>
      <p className={styles.telegramNote}>{content.telegramNote}</p>
    </form>
  );
}

function validate(values: LeadFormValues): Partial<Record<keyof LeadFormValues, string>> {
  const errors: Partial<Record<keyof LeadFormValues, string>> = {};
  const name = values.name.trim();
  if (!name) {
    errors.name = content.errors.required;
  } else if (name.length < 2 || name.length > 80 || !/\p{L}/u.test(name) || /[\u0000-\u001F\u007F-\u009F]/u.test(name)) {
    errors.name = content.errors.invalidName;
  }
  const normalizedPhone = values.phone.replace(/\D/g, "");
  if (values.phone.trim().length < 7 || values.phone.trim().length > 32 || !/^[0-9+().\- /]+$/u.test(values.phone) || normalizedPhone.length < 7 || normalizedPhone.length > 15) {
    errors.phone = content.errors.invalidPhone;
  }
  if (values.goal.trim().length > 300 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(values.goal) || /\r(?!\n)/u.test(values.goal)) {
    errors.goal = content.errors.invalidGoal;
  }
  if (!values.consent) {
    errors.consent = content.errors.consentRequired;
  }
  return errors;
}

function toLeadRequest(values: LeadFormValues): LeadSubmitRequest {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    ...(values.goal.trim() ? { goal: values.goal.trim() } : {}),
    consent: true,
    website: "",
    startedAt: Date.now(),
  };
}

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function isLeadSuccess(payload: unknown): payload is LeadSubmitSuccess {
  return typeof payload === "object" && payload !== null
    && (payload as LeadSubmitSuccess).ok === true
    && (payload as LeadSubmitSuccess).status === "email_accepted"
    && typeof (payload as LeadSubmitSuccess).telegramDeepLink === "string";
}

function isLeadError(payload: unknown): payload is LeadSubmitError {
  return typeof payload === "object" && payload !== null && (payload as LeadSubmitError).ok === false;
}

function mapServerFieldErrors(errors: Record<string, string[]> | undefined): Partial<Record<keyof LeadFormValues, string>> {
  return {
    ...(errors?.name?.[0] ? { name: errors.name[0] } : {}),
    ...(errors?.phone?.[0] ? { phone: errors.phone[0] } : {}),
    ...(errors?.goal?.[0] ? { goal: errors.goal[0] } : {}),
    ...(errors?.consent?.[0] ? { consent: errors.consent[0] } : {}),
  };
}
