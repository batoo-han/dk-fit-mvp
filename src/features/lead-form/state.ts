export type LeadFormStatus =
  | "idle"
  | "validating"
  | "submitting"
  | "email_accepted"
  | "redirecting"
  | "validation_error"
  | "rate_limited"
  | "delivery_error";

export type LeadFormValues = {
  name: string;
  phone: string;
  goal: string;
  consent: boolean;
};

export type LeadFormState = {
  status: LeadFormStatus;
  values: LeadFormValues;
  fieldErrors: Partial<Record<keyof LeadFormValues, string>>;
  message?: string;
  telegramDeepLink?: string;
};

export const initialLeadFormState: LeadFormState = {
  status: "idle",
  values: { name: "", phone: "", goal: "", consent: false },
  fieldErrors: {},
};

export type LeadFormAction =
  | { type: "UPDATE"; field: keyof LeadFormValues; value: string | boolean }
  | { type: "VALIDATE" }
  | { type: "VALIDATION_ERROR"; fieldErrors: Partial<Record<keyof LeadFormValues, string>> }
  | { type: "SUBMIT" }
  | { type: "EMAIL_ACCEPTED"; telegramDeepLink: string }
  | { type: "REDIRECT" }
  | { type: "RATE_LIMITED"; message?: string }
  | { type: "DELIVERY_ERROR"; message: string };

export function leadFormReducer(state: LeadFormState, action: LeadFormAction): LeadFormState {
  switch (action.type) {
    case "UPDATE":
      return {
        ...state,
        status: "idle",
        message: undefined,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
        values: { ...state.values, [action.field]: action.value } as LeadFormValues,
      };
    case "VALIDATE":
      return { ...state, status: "validating", message: undefined, fieldErrors: {} };
    case "VALIDATION_ERROR":
      return { ...state, status: "validation_error", fieldErrors: action.fieldErrors };
    case "SUBMIT":
      return { ...state, status: "submitting", message: undefined, fieldErrors: {} };
    case "EMAIL_ACCEPTED":
      return { ...state, status: "email_accepted", telegramDeepLink: action.telegramDeepLink, fieldErrors: {} };
    case "REDIRECT":
      return { ...state, status: "redirecting" };
    case "RATE_LIMITED":
      return { ...state, status: "rate_limited", message: action.message };
    case "DELIVERY_ERROR":
      return { ...state, status: "delivery_error", message: action.message };
  }
}
