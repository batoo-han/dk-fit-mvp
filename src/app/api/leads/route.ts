import "server-only";

import { isIP } from "node:net";

import { getServerEnv, type ServerEnv } from "../../../lib/config/env";
import { leadSubmitSchema, type LeadErrorCode, type LeadSubmitRequest } from "../../../lib/contracts/lead";
import { createLeadIdempotency, type LeadIdempotency } from "../../../lib/leads/idempotency";
import { createLeadMailer } from "../../../lib/leads/mailer";
import { createLeadRateLimiter, type LeadRateLimiter } from "../../../lib/leads/rate-limit";
import { submitLead } from "../../../lib/leads/service";
import { getRedisClient } from "../../../lib/redis/client";
import { fingerprintPhone } from "../../../lib/security/fingerprint";
import { hasSameOrigin } from "../../../lib/security/origin";
import { createRequestId } from "../../../lib/security/request-id";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const MIN_SUBMIT_DELAY_MS = 2_000;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type RouteEnvironment = Pick<ServerEnv, "publicSiteUrl" | "siteAuthorFullName" | "leadRecipientEmail"> & {
  telegram: Pick<ServerEnv["telegram"], "username">;
};

type ParsedJsonBody = { ok: true; value: unknown } | { ok: false };

type PreparedLeadRequest = {
  requestId: string;
  startedAt: number;
  payload: unknown;
};

export type LeadRouteDependencies = {
  env: RouteEnvironment;
  idempotency: LeadIdempotency;
  rateLimiter: LeadRateLimiter;
  piiHashSecret: string;
  sendEmail(message: { to: string; subject: "D&K Fit — новая заявка"; text: string }): Promise<void>;
  log(event: { requestId: string; status: number; durationMs: number; leadFingerprint?: string }): void;
  now(): number;
};

export function createLeadRouteHandler(dependencies: LeadRouteDependencies) {
  return async function handleLead(request: Request): Promise<Response> {
    return handleLeadRequest(request, dependencies);
  };
}

async function handleLeadRequest(
  request: Request,
  dependencies: LeadRouteDependencies,
  preparedRequest?: PreparedLeadRequest,
): Promise<Response> {
    const requestId = preparedRequest?.requestId ?? createRequestId();
    const startedAt = preparedRequest?.startedAt ?? dependencies.now();
    let leadFingerprint: string | undefined;
    const respond = (response: Response, status: number) => {
      dependencies.log({ requestId, status, durationMs: Math.max(0, dependencies.now() - startedAt), leadFingerprint });
      return response;
    };

    if (!isJsonRequest(request)) {
      return respond(errorResponse(400, "INVALID_REQUEST", requestId), 400);
    }

    const payload: ParsedJsonBody = preparedRequest ? { ok: true, value: preparedRequest.payload } : await parseJsonBody(request);
    if (!payload.ok) {
      return respond(errorResponse(400, "INVALID_REQUEST", requestId), 400);
    }

    if (!hasSameOrigin(request.headers.get("origin"), dependencies.env.publicSiteUrl)) {
      return respond(errorResponse(403, "INVALID_ORIGIN", requestId), 403);
    }

    const validation = leadSubmitSchema.safeParse(payload.value);
    if (!validation.success) {
      return respond(errorResponse(422, "INVALID_REQUEST", requestId, validation.error.flatten().fieldErrors), 422);
    }
    const lead = validation.data;
    leadFingerprint = fingerprintPhone(lead.phone, dependencies.piiHashSecret);
    if ((lead.website !== undefined && lead.website !== "") || dependencies.now() - lead.startedAt < MIN_SUBMIT_DELAY_MS) {
      return respond(errorResponse(422, "INVALID_REQUEST", requestId), 422);
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !UUID_V4_PATTERN.test(idempotencyKey)) {
      return respond(errorResponse(400, "INVALID_REQUEST", requestId), 400);
    }

    const outcome = await submitLead(
      {
        environment: dependencies.env,
        idempotency: dependencies.idempotency,
        rateLimiter: dependencies.rateLimiter,
        sendEmail: dependencies.sendEmail,
      },
      {
        idempotencyKey,
        requestPayload: canonicalLeadPayload(lead),
        lead,
        ip: trustedProxyClientIp(request.headers),
      },
    );

    switch (outcome.kind) {
      case "accepted":
        return respond(
          Response.json(
            { ok: true, status: "email_accepted", telegramDeepLink: outcome.telegramDeepLink },
            { status: 201, headers: noStoreHeaders() },
          ),
          201,
        );
      case "idempotency_conflict":
        return respond(errorResponse(409, "IDEMPOTENCY_CONFLICT", requestId), 409);
      case "request_in_progress":
        return respond(errorResponse(409, "REQUEST_IN_PROGRESS", requestId), 409);
      case "rate_limited":
        return respond(errorResponse(429, "RATE_LIMITED", requestId), 429);
      case "email_unavailable":
        return respond(errorResponse(503, "EMAIL_UNAVAILABLE", requestId), 503);
      case "configuration_error":
        return respond(errorResponse(503, "CONFIGURATION_ERROR", requestId), 503);
      case "internal_error":
        return respond(errorResponse(500, "INTERNAL_ERROR", requestId), 500);
    }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const preflight = await prepareProductionRequest(request, requestId, startedAt);
  if (!preflight.ok) {
    return preflight.response;
  }

  try {
    const env = getServerEnv();
    const redis = await getRedisClient();
    const mailer = createLeadMailer(env);
    return await handleLeadRequest(request, {
      env,
      idempotency: createLeadIdempotency({ redis, piiHashSecret: env.piiHashSecret }),
      rateLimiter: createLeadRateLimiter({ redis, piiHashSecret: env.piiHashSecret }),
      piiHashSecret: env.piiHashSecret,
      sendEmail: (message) => mailer.send(message),
      log: (event) => console.info("lead_request", event),
      now: Date.now,
    }, preflight.preparedRequest);
  } catch {
    console.error("lead_route_unavailable", { requestId, status: 503, durationMs: Date.now() - startedAt });
    return errorResponse(503, "CONFIGURATION_ERROR", requestId);
  }
}

async function prepareProductionRequest(
  request: Request,
  requestId: string,
  startedAt: number,
): Promise<{ ok: true; preparedRequest: PreparedLeadRequest } | { ok: false; response: Response }> {
  if (!isJsonRequest(request)) {
    return { ok: false, response: errorResponse(400, "INVALID_REQUEST", requestId) };
  }

  const payload = await parseJsonBody(request);
  if (!payload.ok) {
    return { ok: false, response: errorResponse(400, "INVALID_REQUEST", requestId) };
  }

  if (!hasRequestSameOrigin(request)) {
    return { ok: false, response: errorResponse(403, "INVALID_ORIGIN", requestId) };
  }

  return { ok: true, preparedRequest: { requestId, startedAt, payload: payload.value } };
}

function hasRequestSameOrigin(request: Request): boolean {
  try {
    return hasSameOrigin(request.headers.get("origin"), new URL(request.url));
  } catch {
    return false;
  }
}

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

async function parseJsonBody(request: Request): Promise<ParsedJsonBody> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    return { ok: false };
  }

  try {
    const bytes = await readBoundedBody(request, MAX_BODY_BYTES);
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { ok: false };
  }
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) {
    throw new Error("Request body is required");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Request body exceeds limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function canonicalLeadPayload(lead: LeadSubmitRequest): string {
  return JSON.stringify({
    name: lead.name,
    phone: lead.phone,
    goal: lead.goal ?? null,
    consent: lead.consent,
  });
}

function trustedProxyClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.trim();
  if (!forwardedFor || forwardedFor.includes(",") || isIP(forwardedFor) === 0) {
    return "unknown";
  }

  return forwardedFor;
}

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

function errorResponse(
  status: number,
  code: LeadErrorCode,
  requestId: string,
  fieldErrors?: Record<string, string[] | undefined>,
): Response {
  const errors = fieldErrors
    ? Object.fromEntries(Object.entries(fieldErrors).filter(([, messages]) => messages && messages.length > 0))
    : undefined;
  return Response.json(
    {
      ok: false,
      error: { code, requestId, ...(errors && Object.keys(errors).length > 0 ? { fieldErrors: errors } : {}) },
    },
    { status, headers: noStoreHeaders() },
  );
}
