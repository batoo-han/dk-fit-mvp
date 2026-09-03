import type { LeadSubmitRequest } from "../contracts/lead";
import { RedisUnavailableError } from "../redis/client";
import { buildTelegramDeepLink } from "../telegram/deep-link";
import { formatLeadEmail, type LeadEmailMessage } from "./email-message";
import type { LeadIdempotency } from "./idempotency";
import type { LeadRateLimiter } from "./rate-limit";

import "server-only";

type LeadServiceEnvironment = {
  publicSiteUrl: URL;
  siteAuthorFullName: string;
  leadRecipientEmail: string;
  telegram: { username: string };
};

export type LeadServiceDependencies = {
  environment: LeadServiceEnvironment;
  idempotency: LeadIdempotency;
  rateLimiter: LeadRateLimiter;
  sendEmail(message: LeadEmailMessage): Promise<void>;
};

export type LeadServiceResult =
  | { kind: "accepted"; telegramDeepLink: string }
  | { kind: "idempotency_conflict" }
  | { kind: "request_in_progress" }
  | { kind: "rate_limited" }
  | { kind: "email_unavailable" }
  | { kind: "configuration_error" }
  | { kind: "internal_error" };

export async function submitLead(
  dependencies: LeadServiceDependencies,
  input: {
    idempotencyKey: string;
    requestPayload: string;
    lead: LeadSubmitRequest;
    ip: string;
  },
): Promise<LeadServiceResult> {
  let claim;
  try {
    claim = await dependencies.idempotency.claimLead(input.idempotencyKey, input.requestPayload);
  } catch (error) {
    return isRedisFailure(error) ? { kind: "configuration_error" } : { kind: "internal_error" };
  }

  if (claim.kind === "replay") {
    return { kind: "accepted", telegramDeepLink: buildTelegramDeepLink(dependencies.environment.telegram.username) };
  }
  if (claim.kind === "conflict") {
    return { kind: "idempotency_conflict" };
  }
  if (claim.kind === "processing") {
    return { kind: "request_in_progress" };
  }

  try {
    const rateLimit = await dependencies.rateLimiter.checkLeadRateLimit({ ip: input.ip, phone: input.lead.phone }, claim);
    if (!rateLimit.allowed) {
      const released = await dependencies.idempotency.releaseLead(input.idempotencyKey, claim.token);
      return released ? { kind: "rate_limited" } : { kind: "configuration_error" };
    }
  } catch (error) {
    await releaseAfterRetryableFailure(dependencies.idempotency, input.idempotencyKey, claim.token);
    return isRedisFailure(error) ? { kind: "configuration_error" } : { kind: "internal_error" };
  }

  try {
    await dependencies.sendEmail(formatLeadEmail(dependencies.environment, input.lead));
  } catch {
    // SMTP failures can have an unknown delivery state. Retain this processing claim rather
    // than automatically resending and risking a duplicate lead notification.
    return { kind: "email_unavailable" };
  }

  try {
    const completed = await dependencies.idempotency.completeLead(input.idempotencyKey, claim.token);
    return completed
      ? { kind: "accepted", telegramDeepLink: buildTelegramDeepLink(dependencies.environment.telegram.username) }
      : { kind: "internal_error" };
  } catch (error) {
    return isRedisFailure(error) ? { kind: "configuration_error" } : { kind: "internal_error" };
  }
}

function isRedisFailure(error: unknown): boolean {
  return error instanceof RedisUnavailableError || (error instanceof Error && /redis/iu.test(error.message));
}

async function releaseAfterRetryableFailure(
  idempotency: LeadIdempotency,
  idempotencyKey: string,
  claimToken: string,
): Promise<void> {
  try {
    await idempotency.releaseLead(idempotencyKey, claimToken);
  } catch {
    // The original failure is already being returned without SMTP. Do not leak internals.
  }
}
