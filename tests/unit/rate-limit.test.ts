import { describe, expect, it } from "vitest";

import { createLeadRateLimiter } from "../../src/lib/leads/rate-limit";
import type { LeadClaimResult } from "../../src/lib/leads/idempotency";
import type { RedisStore } from "../../src/lib/redis/client";

type Entry = { value: string; expiresAt?: number };

class FakeRedis implements RedisStore {
  readonly entries = new Map<string, Entry>();
  unavailable = false;
  readonly evalCalls: Array<{ key: string; ttlSeconds: number }> = [];

  async get(key: string): Promise<string | null> {
    this.throwIfUnavailable();
    return this.entries.get(key)?.value ?? null;
  }

  async set(): Promise<"OK" | null> {
    throw new Error("Not used by rate-limit tests");
  }

  async incr(): Promise<number> {
    throw new Error("Rate limiter must increment atomically with expiry");
  }

  async eval(_script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown> {
    this.throwIfUnavailable();
    const key = options.keys[0];
    const ttlSeconds = Number(options.arguments[0]);
    this.evalCalls.push({ key, ttlSeconds });
    const current = Number(this.entries.get(key)?.value ?? "0") + 1;
    this.entries.set(key, {
      value: String(current),
      expiresAt: this.entries.get(key)?.expiresAt ?? Date.now() + ttlSeconds * 1_000,
    });
    return current;
  }

  private throwIfUnavailable() {
    if (this.unavailable) {
      throw new Error("Redis connection refused");
    }
  }
}

const claimed: LeadClaimResult = { kind: "claimed", token: "00000000-0000-4000-8000-000000000000" };

describe("lead rate limiting", () => {
  const secret = "s".repeat(32);
  const subject = { ip: "203.0.113.42", phone: "+7 (900) 000-00-00" };
  const utcDayStart = 1_699_920_000_000;

  it("allows exactly five new leads per IP in ten minutes and blocks the sixth", async () => {
    const limiter = createLeadRateLimiter({ redis: new FakeRedis(), piiHashSecret: secret, now: () => 1_700_000_000_000 });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        limiter.checkLeadRateLimit({ ...subject, phone: `+7 (900) 000-00-0${attempt}` }, claimed),
      ).resolves.toMatchObject({ allowed: true, charged: true });
    }

    await expect(limiter.checkLeadRateLimit({ ...subject, phone: "+7 (900) 000-00-09" }, claimed)).resolves.toMatchObject({
      allowed: false,
      scope: "ip:10m",
    });
  });

  it("allows exactly thirty new leads per IP per day and blocks the thirty-first", async () => {
    let now = utcDayStart + 1_000;
    const limiter = createLeadRateLimiter({ redis: new FakeRedis(), piiHashSecret: secret, now: () => now });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      now = utcDayStart + 1_000 + attempt * 10 * 60 * 1_000;
      await expect(
        limiter.checkLeadRateLimit({ ...subject, phone: `+7 (900) 123-45-${String(attempt).padStart(2, "0")}` }, claimed),
      ).resolves.toMatchObject({ allowed: true });
    }

    now += 10 * 60 * 1_000;
    await expect(limiter.checkLeadRateLimit({ ...subject, phone: "+7 (900) 123-45-99" }, claimed)).resolves.toMatchObject({
      allowed: false,
      scope: "ip:1d",
    });
  });

  it("uses independent exact hour and day limits for a normalized phone", async () => {
    const redis = new FakeRedis();
    const limiter = createLeadRateLimiter({ redis, piiHashSecret: secret, now: () => 1_700_000_000_000 });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await limiter.checkLeadRateLimit(subject, claimed);
    }

    await expect(limiter.checkLeadRateLimit(subject, claimed)).resolves.toMatchObject({
      allowed: false,
      scope: "phone:1h",
    });
    expect(redis.evalCalls.map((call) => call.key)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^lead:rate:phone:[a-f0-9]{64}:1h:/),
        expect.stringMatching(/^lead:rate:phone:[a-f0-9]{64}:1d:/),
      ]),
    );
  });

  it("allows exactly five new leads per normalized phone per day and blocks the sixth", async () => {
    let now = utcDayStart + 1_000;
    const limiter = createLeadRateLimiter({ redis: new FakeRedis(), piiHashSecret: secret, now: () => now });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      now = utcDayStart + 1_000 + attempt * 60 * 60 * 1_000;
      await expect(
        limiter.checkLeadRateLimit({ ip: `203.0.113.${attempt}`, phone: subject.phone }, claimed),
      ).resolves.toMatchObject({ allowed: true });
    }

    now += 60 * 60 * 1_000;
    await expect(limiter.checkLeadRateLimit({ ip: "203.0.113.99", phone: subject.phone }, claimed)).resolves.toMatchObject({
      allowed: false,
      scope: "phone:1d",
    });
  });

  it("does not charge a successful replay again", async () => {
    const redis = new FakeRedis();
    const limiter = createLeadRateLimiter({ redis, piiHashSecret: secret, now: () => 1_700_000_000_000 });

    await expect(limiter.checkLeadRateLimit(subject, { kind: "replay" })).resolves.toEqual({
      allowed: true,
      charged: false,
    });
    expect(redis.evalCalls).toHaveLength(0);
  });

  it("fails closed when Redis is unavailable", async () => {
    const redis = new FakeRedis();
    redis.unavailable = true;
    const limiter = createLeadRateLimiter({ redis, piiHashSecret: secret });

    await expect(limiter.checkLeadRateLimit(subject, claimed)).rejects.toMatchObject({
      name: "RedisUnavailableError",
    });
  });
});
