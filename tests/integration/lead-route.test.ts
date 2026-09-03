import { describe, expect, it, vi } from "vitest";

import * as environmentConfig from "../../src/lib/config/env";
import * as redisClient from "../../src/lib/redis/client";
import {
  createLeadRouteHandler,
  POST,
  type LeadRouteDependencies,
} from "../../src/app/api/leads/route";

const CLAIM_TOKEN = "00000000-0000-4000-8000-000000000000";
const IDEMPOTENCY_KEY = "5fa1332a-205a-4f83-9fd2-f22bbbf18a20";

function leadPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Анна Иванова",
    phone: "+7 900 000-00-00",
    goal: "Стать сильнее",
    consent: true,
    website: "",
    startedAt: Date.now() - 2_001,
    ...overrides,
  };
}

function leadRequest({
  body = leadPayload(),
  contentType = "application/json",
  origin = "https://dk-fit.test",
  idempotencyKey = IDEMPOTENCY_KEY,
  forwardedFor = "203.0.113.42",
}: {
  body?: unknown;
  contentType?: string;
  origin?: string;
  idempotencyKey?: string;
  forwardedFor?: string | null;
} = {}) {
  return new Request("https://dk-fit.test/api/leads", {
    method: "POST",
    headers: {
      "content-type": contentType,
      origin,
      "idempotency-key": idempotencyKey,
      ...(forwardedFor === null ? {} : { "x-forwarded-for": forwardedFor }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function handlerWith(overrides: Partial<LeadRouteDependencies> = {}) {
  const dependencies: LeadRouteDependencies = {
    env: {
      publicSiteUrl: new URL("https://dk-fit.test"),
      siteAuthorFullName: "Тестовый Автор",
      telegram: { username: "test_bot" },
    },
    idempotency: {
      claimLead: vi.fn().mockResolvedValue({ kind: "claimed", token: CLAIM_TOKEN }),
      completeLead: vi.fn().mockResolvedValue(true),
      releaseLead: vi.fn().mockResolvedValue(true),
    },
    rateLimiter: {
      checkLeadRateLimit: vi.fn().mockResolvedValue({ allowed: true, charged: true }),
    },
    piiHashSecret: "s".repeat(32),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    now: () => Date.now(),
    ...overrides,
  };

  return { handler: createLeadRouteHandler(dependencies), dependencies };
}

async function expectSafeError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: { code, requestId: expect.any(String) },
  });
}

describe("POST /api/leads", () => {
  it("rejects non-JSON and malformed JSON before reading lead dependencies", async () => {
    const { handler, dependencies } = handlerWith();

    await expectSafeError(await handler(leadRequest({ contentType: "text/plain" })), 400, "INVALID_REQUEST");
    await expectSafeError(await handler(leadRequest({ body: "{" })), 400, "INVALID_REQUEST");
    expect(dependencies.idempotency.claimLead).not.toHaveBeenCalled();
  });

  it("rejects a body larger than 8 KiB", async () => {
    const { handler, dependencies } = handlerWith();
    const response = await handler(leadRequest({ body: "x".repeat(8 * 1024 + 1) }));

    await expectSafeError(response, 400, "INVALID_REQUEST");
    expect(dependencies.idempotency.claimLead).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before schema and SMTP work", async () => {
    const { handler, dependencies } = handlerWith();
    const response = await handler(leadRequest({ origin: "https://attacker.test" }));

    await expectSafeError(response, 403, "INVALID_ORIGIN");
    expect(dependencies.idempotency.claimLead).not.toHaveBeenCalled();
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without leaking a Telegram URL", async () => {
    const { handler, dependencies } = handlerWith();
    const response = await handler(leadRequest({ body: leadPayload({ name: "1" }) }));

    expect(response.status).toBe(422);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST", requestId: expect.any(String), fieldErrors: { name: expect.any(Array) } },
    });
    expect(dependencies.idempotency.claimLead).not.toHaveBeenCalled();
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it("blocks the honeypot without creating an SMTP side effect", async () => {
    const { handler, dependencies } = handlerWith();
    const response = await handler(leadRequest({ body: leadPayload({ website: "bot" }) }));

    await expectSafeError(response, 422, "INVALID_REQUEST");
    expect(dependencies.idempotency.claimLead).not.toHaveBeenCalled();
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it("accepts an omitted optional honeypot field as a legitimate lead", async () => {
    const { handler, dependencies } = handlerWith();
    const { website: _website, ...payload } = leadPayload();

    const response = await handler(leadRequest({ body: payload }));

    expect(response.status).toBe(201);
    expect(dependencies.sendEmail).toHaveBeenCalledOnce();
  });

  it("blocks a too-fast submit without creating an SMTP side effect", async () => {
    const { handler, dependencies } = handlerWith();
    const response = await handler(leadRequest({ body: leadPayload({ startedAt: Date.now() - 1_000 }) }));

    await expectSafeError(response, 422, "INVALID_REQUEST");
    expect(dependencies.idempotency.claimLead).not.toHaveBeenCalled();
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it("returns a safe 409 for conflicting and in-progress idempotency keys", async () => {
    for (const [claim, code] of [
      [{ kind: "conflict" }, "IDEMPOTENCY_CONFLICT"],
      [{ kind: "processing" }, "REQUEST_IN_PROGRESS"],
    ] as const) {
      const { handler, dependencies } = handlerWith({
        idempotency: {
          claimLead: vi.fn().mockResolvedValue(claim),
          completeLead: vi.fn(),
          releaseLead: vi.fn(),
        },
      });
      await expectSafeError(await handler(leadRequest()), 409, code);
      expect(dependencies.sendEmail).not.toHaveBeenCalled();
    }
  });

  it("releases its matching new claim before a rate-limit response", async () => {
    const releaseLead = vi.fn().mockResolvedValue(true);
    const { handler, dependencies } = handlerWith({
      idempotency: {
        claimLead: vi.fn().mockResolvedValue({ kind: "claimed", token: CLAIM_TOKEN }),
        completeLead: vi.fn(),
        releaseLead,
      },
      rateLimiter: { checkLeadRateLimit: vi.fn().mockResolvedValue({ allowed: false, charged: true, scope: "ip:10m" }) },
    });

    await expectSafeError(await handler(leadRequest()), 429, "RATE_LIMITED");
    expect(releaseLead).toHaveBeenCalledWith(IDEMPOTENCY_KEY, CLAIM_TOKEN);
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it("uses a single validated client address supplied by the trusted proxy", async () => {
    const checkLeadRateLimit = vi.fn().mockResolvedValue({ allowed: true, charged: true });
    const { handler } = handlerWith({ rateLimiter: { checkLeadRateLimit } });

    expect((await handler(leadRequest({ forwardedFor: "2001:db8::42" }))).status).toBe(201);
    expect(checkLeadRateLimit).toHaveBeenCalledWith(
      { ip: "2001:db8::42", phone: "+7 900 000-00-00" },
      { kind: "claimed", token: CLAIM_TOKEN },
    );
  });

  it.each([
    ["a missing header", null],
    ["an invalid value", "not-an-ip"],
    ["a spoofable forwarded chain", "198.51.100.10, 203.0.113.42"],
  ])("does not use %s as a rate-limit identity", async (_scenario, forwardedFor) => {
    const checkLeadRateLimit = vi.fn().mockResolvedValue({ allowed: true, charged: true });
    const { handler } = handlerWith({ rateLimiter: { checkLeadRateLimit } });

    expect((await handler(leadRequest({ forwardedFor }))).status).toBe(201);
    expect(checkLeadRateLimit).toHaveBeenCalledWith(
      { ip: "unknown", phone: "+7 900 000-00-00" },
      { kind: "claimed", token: CLAIM_TOKEN },
    );
  });

  it("fails closed when Redis is unavailable before SMTP", async () => {
    const { handler, dependencies } = handlerWith({
      idempotency: {
        claimLead: vi.fn().mockRejectedValue(new Error("Redis unavailable")),
        completeLead: vi.fn(),
        releaseLead: vi.fn(),
      },
    });

    await expectSafeError(await handler(leadRequest()), 503, "CONFIGURATION_ERROR");
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it("returns the configured deep link only after SMTP acceptance and records the matching claim", async () => {
    const { handler, dependencies } = handlerWith();
    const response = await handler(leadRequest());

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "email_accepted",
      telegramDeepLink: "https://t.me/test_bot?start=registered",
    });
    expect(dependencies.sendEmail).toHaveBeenCalledWith({
      to: "superhumansmm@yandex.ru",
      subject: "D&K Fit — новая заявка",
      text: expect.stringContaining("Анна Иванова"),
    });
    expect(dependencies.idempotency.completeLead).toHaveBeenCalledWith(IDEMPOTENCY_KEY, CLAIM_TOKEN);
  });

  it("replays a previously accepted lead without SMTP or another rate charge", async () => {
    const { handler, dependencies } = handlerWith({
      idempotency: {
        claimLead: vi.fn().mockResolvedValue({ kind: "replay" }),
        completeLead: vi.fn(),
        releaseLead: vi.fn(),
      },
    });

    const response = await handler(leadRequest());
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ telegramDeepLink: "https://t.me/test_bot?start=registered" });
    expect(dependencies.rateLimiter.checkLeadRateLimit).not.toHaveBeenCalled();
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it.each([new Error("SMTP rejected: private detail"), new Error("SMTP timeout: private detail")])(
    "redacts SMTP errors and never returns a Telegram URL",
    async (smtpError) => {
      const { handler, dependencies } = handlerWith({ sendEmail: vi.fn().mockRejectedValue(smtpError) });
      const response = await handler(leadRequest());
      const responseText = await response.clone().text();

      await expectSafeError(response, 503, "EMAIL_UNAVAILABLE");
      expect(responseText).not.toContain("private detail");
      expect(dependencies.idempotency.completeLead).not.toHaveBeenCalled();
    },
  );

  it("redacts unexpected failures and never logs raw lead values", async () => {
    const log = vi.fn();
    const { handler } = handlerWith({
      log,
      idempotency: {
        claimLead: vi.fn().mockResolvedValue({ kind: "claimed", token: CLAIM_TOKEN }),
        completeLead: vi.fn().mockResolvedValue(false),
        releaseLead: vi.fn(),
      },
    });
    const response = await handler(leadRequest());

    await expectSafeError(response, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(log.mock.calls)).not.toContain("Анна Иванова");
    expect(JSON.stringify(log.mock.calls)).not.toContain("900 000");
    expect(JSON.stringify(log.mock.calls)).not.toContain("Стать сильнее");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ leadFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u) }),
    );
  });

  it("runs malformed-content and origin gates before unavailable production dependencies", async () => {
    const getServerEnv = vi.spyOn(environmentConfig, "getServerEnv").mockImplementation(() => {
      throw new Error("misconfigured server environment");
    });
    const getRedisClient = vi.spyOn(redisClient, "getRedisClient").mockRejectedValue(new Error("Redis unavailable"));

    try {
      await expectSafeError(await POST(leadRequest({ contentType: "text/plain" })), 400, "INVALID_REQUEST");
      await expectSafeError(await POST(leadRequest({ body: "{" })), 400, "INVALID_REQUEST");
      await expectSafeError(await POST(leadRequest({ origin: "https://attacker.test" })), 403, "INVALID_ORIGIN");
      expect(getServerEnv).not.toHaveBeenCalled();
      expect(getRedisClient).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
