import { z } from "zod";

const controlCharacterPattern = /[\u0000-\u001F\u007F-\u009F]/u;
const goalControlCharacterPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

function addIssue(context: z.RefinementCtx, path: string[], message: string) {
  context.addIssue({ code: "custom", path, message });
}

export const leadSubmitSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(7).max(32),
    goal: z.string().trim().max(300).optional(),
    consent: z.literal(true),
    website: z.literal("").optional(),
    startedAt: z.number().int().positive(),
  })
  .strict()
  .superRefine((lead, context) => {
    if (!/\p{L}/u.test(lead.name)) {
      addIssue(context, ["name"], "Name must include a letter");
    }
    if (controlCharacterPattern.test(lead.name)) {
      addIssue(context, ["name"], "Name cannot include control characters");
    }

    const normalizedPhone = lead.phone.replace(/\D/g, "");
    if (!/^[0-9+().\- /]+$/.test(lead.phone) || normalizedPhone.length < 7 || normalizedPhone.length > 15) {
      addIssue(context, ["phone"], "Phone must contain 7 to 15 digits and formatting only");
    }
    if (controlCharacterPattern.test(lead.phone)) {
      addIssue(context, ["phone"], "Phone cannot include control characters");
    }

    if (
      lead.goal &&
      (goalControlCharacterPattern.test(lead.goal) || /\r(?!\n)/u.test(lead.goal))
    ) {
      addIssue(context, ["goal"], "Goal can only include ordinary line breaks");
    }
  });

export type LeadSubmitRequest = z.infer<typeof leadSubmitSchema>;

export type LeadSubmitSuccess = {
  ok: true;
  status: "email_accepted";
  telegramDeepLink: string;
};

export type LeadErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ORIGIN"
  | "IDEMPOTENCY_CONFLICT"
  | "REQUEST_IN_PROGRESS"
  | "RATE_LIMITED"
  | "EMAIL_UNAVAILABLE"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export type LeadSubmitError = {
  ok: false;
  error: {
    code: LeadErrorCode;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
};
