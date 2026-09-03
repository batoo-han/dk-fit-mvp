"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { InputField, TextareaField } from "../../components/ui/Field";
import type { LeadSubmitError, LeadSubmitSuccess } from "../../lib/contracts/lead";
import { landingContent } from "../../content/landing.ru";
import styles from "./LeadForm.module.css";
import { initialLeadFormState, leadFormReducer, type LeadFormValues } from "./state";
import { submitLead, type LeadSubmitClientRequest } from "./submit-lead";

type LeadFormProps = {
  request?: (payload: LeadSubmitClientRequest, idempotencyKey: string) => Promise<Response>;
};

const content = landingContent.leadForm;
const DELIVERY_RECHECK_DELAY_MS = 2_000;
const MAX_DELIVERY_RECHECKS = 75;

export function LeadForm({ request = submitLead }: LeadFormProps) {
  const [state, dispatch] = useReducer(leadFormReducer, initialLeadFormState);
  const idempotencyKey = useRef<string | undefined>(undefined);
  const form = useRef<HTMLFormElement | null>(null);
  const [formStartedAt] = useState(() => Date.now());
  const honeypot = useRef<HTMLInputElement | null>(null);
  const firstInvalidField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const telegramWindow = useRef<Window | null>(null);

  useEffect(() => () => {
    closeTelegramWindow(telegramWindow);
  }, []);

  useEffect(() => {
    form.current?.setAttribute("data-client-ready", "true");
  }, []);

  function update(field: keyof LeadFormValues, value: string | boolean) {
    idempotencyKey.current = undefined;
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
    telegramWindow.current = reserveTelegramWindow();
    dispatch({ type: "SUBMIT" });
    const leadRequest = toLeadRequest(state.values, formStartedAt, honeypot.current?.value ?? "");
    for (let rechecks = 0; rechecks <= MAX_DELIVERY_RECHECKS; rechecks += 1) {
      try {
        const response = await request(leadRequest, key);
        const payload = await safeJson(response);
        if (response.status === 201 && isLeadSuccess(payload)) {
          dispatch({ type: "EMAIL_ACCEPTED", telegramDeepLink: payload.telegramDeepLink });
          navigateTelegramWindow(telegramWindow, payload.telegramDeepLink);
          return;
        }

        if (isRequestInProgress(response, payload) && rechecks < MAX_DELIVERY_RECHECKS) {
          await waitForDeliveryRecheck();
          continue;
        }

        if (response.status === 422 && isLeadError(payload)) {
          const serverFieldErrors = mapServerFieldErrors(payload.error.fieldErrors);
          if (Object.keys(serverFieldErrors).length === 0) {
            closeTelegramWindow(telegramWindow);
            dispatch({ type: "VALIDATION_ERROR", fieldErrors: {}, message: "Проверьте введённые данные и повторите попытку." });
            return;
          }
          closeTelegramWindow(telegramWindow);
          dispatch({ type: "VALIDATION_ERROR", fieldErrors: serverFieldErrors });
          window.requestAnimationFrame(() => firstInvalidField.current?.focus());
          return;
        }
        if (response.status === 429) {
          closeTelegramWindow(telegramWindow);
          dispatch({ type: "RATE_LIMITED", message: content.errors.rateLimited });
          return;
        }
        closeTelegramWindow(telegramWindow);
        dispatch({ type: "DELIVERY_ERROR", message: content.errors.unavailable });
        return;
      } catch (error) {
        if (isRequestTimeout(error) && rechecks < MAX_DELIVERY_RECHECKS) {
          await waitForDeliveryRecheck();
          continue;
        }
        closeTelegramWindow(telegramWindow);
        dispatch({ type: "DELIVERY_ERROR", message: content.errors.connection });
        return;
      }
    }
  }

  const isSubmitting = state.status === "submitting" || state.status === "email_accepted" || state.status === "redirecting";
  const message = state.status === "email_accepted" || state.status === "redirecting"
    ? content.successMessage
    : state.message;
  const messageKind = state.status === "email_accepted" || state.status === "redirecting" ? "success" : "error";

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit} ref={form}>
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
        <input
          autoComplete="off"
          id="lead-website"
          name="website"
          onChange={() => { idempotencyKey.current = undefined; }}
          ref={honeypot}
          tabIndex={-1}
          type="text"
        />
      </div>
      <button className={styles.submit} disabled={isSubmitting} type="submit">
        {isSubmitting ? "Отправляем…" : content.submitLabel}
      </button>
      <p aria-live="polite" className={styles.message} data-kind={messageKind} role="status">
        {message}
      </p>
      {state.status === "email_accepted" && state.telegramDeepLink ? (
        <a className={styles.telegramLink} href={state.telegramDeepLink} rel="noopener noreferrer" target="_blank">
          {content.telegramOpenLabel}
        </a>
      ) : null}
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

function toLeadRequest(values: LeadFormValues, startedAt: number, website: string): LeadSubmitClientRequest {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    ...(values.goal.trim() ? { goal: values.goal.trim() } : {}),
    consent: true,
    website,
    startedAt,
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

function isRequestInProgress(response: Response, payload: unknown): boolean {
  return response.status === 409
    && isLeadError(payload)
    && payload.error.code === "REQUEST_IN_PROGRESS";
}

function isRequestTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function waitForDeliveryRecheck(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, DELIVERY_RECHECK_DELAY_MS));
}

function reserveTelegramWindow(): Window | null {
  try {
    const reservedWindow = window.open("about:blank", "dk-fit-telegram");
    if (reservedWindow) {
      reservedWindow.opener = null;
    }
    return reservedWindow;
  } catch {
    return null;
  }
}

function navigateTelegramWindow(target: React.RefObject<Window | null>, deepLink: string): void {
  const reservedWindow = target.current;
  target.current = null;
  if (!reservedWindow || reservedWindow.closed) {
    return;
  }
  try {
    reservedWindow.location.assign(deepLink);
  } catch {
    reservedWindow.close();
  }
}

function closeTelegramWindow(target: React.RefObject<Window | null>): void {
  const reservedWindow = target.current;
  target.current = null;
  if (reservedWindow && !reservedWindow.closed) {
    reservedWindow.close();
  }
}

function mapServerFieldErrors(errors: Record<string, string[]> | undefined): Partial<Record<keyof LeadFormValues, string>> {
  return {
    ...(errors?.name?.[0] ? { name: errors.name[0] } : {}),
    ...(errors?.phone?.[0] ? { phone: errors.phone[0] } : {}),
    ...(errors?.goal?.[0] ? { goal: errors.goal[0] } : {}),
    ...(errors?.consent?.[0] ? { consent: errors.consent[0] } : {}),
  };
}
