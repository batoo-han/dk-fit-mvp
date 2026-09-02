import { z } from "zod";

const controlCharacterPattern = /[\u0000-\u001F\u007F-\u009F]/u;
const goalControlCharacterPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

function addIssue(context: z.RefinementCtx, path: string[], message: string) {
  context.addIssue({ code: "custom", path, message });
}

const rawName = z
  .string()
  .superRefine((value, context) => {
    if (controlCharacterPattern.test(value)) {
      addIssue(context, [], "Name cannot include control characters");
    }
  })
  .transform((value) => value.trim())
  .pipe(z.string().min(2).max(80));

const rawPhone = z
  .string()
  .superRefine((value, context) => {
    if (controlCharacterPattern.test(value)) {
      addIssue(context, [], "Phone cannot include control characters");
    }
  })
  .transform((value) => value.trim())
  .pipe(z.string().min(7).max(32));

const rawGoal = z
  .string()
  .superRefine((value, context) => {
    if (goalControlCharacterPattern.test(value) || /\r(?!\n)/u.test(value)) {
      addIssue(context, [], "Goal can only include ordinary line breaks");
    }
  })
  .transform((value) => value.trim())
  .pipe(z.string().max(300));

export const leadSubmitSchema = z
  .object({
    name: rawName,
    phone: rawPhone,
    goal: rawGoal.optional(),
    consent: z.literal(true),
    website: z.literal("").optional(),
    startedAt: z.number().int().positive(),
  })
  .strict()
  .superRefine((lead, context) => {
    if (!/\p{L}/u.test(lead.name)) {
      addIssue(context, ["name"], "Name must include a letter");
    }
    const normalizedPhone = lead.phone.replace(/\D/g, "");
    if (!/^[0-9+().\- /]+$/.test(lead.phone) || normalizedPhone.length < 7 || normalizedPhone.length > 15) {
      addIssue(context, ["phone"], "Phone must contain 7 to 15 digits and formatting only");
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
