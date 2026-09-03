import { describe, expect, it } from "vitest";

import {
  LEAD_IDEMPOTENCY_TTL_SECONDS,
  createLeadIdempotency,
} from "../../src/lib/leads/idempotency";
import {
  claimRedisKeysOnce,
  releaseRedisKeysIfOwned,
  type RedisStore,
} from "../../src/lib/redis/client";

type Entry = { value: string; expiresAt?: number };

class FakeRedis implements RedisStore {
  readonly entries = new Map<string, Entry>();
  unavailable = false;
  private timestamp = 1_700_000_000_000;

  async get(key: string): Promise<string | null> {
    this.throwIfUnavailable();
    return this.read(key)?.value ?? null;
  }

  async set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: true; XX?: true; KEEPTTL?: true },
  ): Promise<"OK" | null> {
    this.throwIfUnavailable();
    const current = this.read(key);
    if ((options?.NX && current) || (options?.XX && !current)) {
      return null;
    }

    this.entries.set(key, {
      value,
      expiresAt: options?.EX ? this.timestamp + options.EX * 1_000 : options?.KEEPTTL ? current?.expiresAt : undefined,
    });
    return "OK";
  }

  async incr(key: string): Promise<number> {
    this.throwIfUnavailable();
    const value = Number(this.read(key)?.value ?? "0") + 1;
    this.entries.set(key, { value: String(value), expiresAt: this.read(key)?.expiresAt });
    return value;
  }

  async eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown> {
    this.throwIfUnavailable();
    if (script.includes("claimToken")) {
      const key = options.keys[0];
      const entry = this.read(key);
      if (!entry) {
        return 0;
      }
      const record = JSON.parse(entry.value) as { status: string; claimToken: string };
      if (record.status !== "processing" || record.claimToken !== options.arguments[0]) {
        return 0;
      }
      if (script.includes("DEL")) {
        this.entries.delete(key);
      } else {
        record.status = "succeeded";
        this.entries.set(key, { value: JSON.stringify(record), expiresAt: entry.expiresAt });
      }
      return 1;
    }
    if (script.includes("claimOwner")) {
      if (options.keys.some((key) => this.read(key)?.value !== options.arguments[0])) {
        return 0;
      }
      options.keys.forEach((key) => this.entries.delete(key));
      return 1;
    }
    const duplicateIndex = options.keys.findIndex((key) => this.read(key));
    if (duplicateIndex >= 0) {
      return duplicateIndex + 1;
    }
    options.keys.forEach((key, index) => {
      const ttlSeconds = Number(options.arguments[index]);
      this.entries.set(key, {
        value: options.arguments[options.keys.length] ?? "1",
        expiresAt: ttlSeconds ? this.timestamp + ttlSeconds * 1_000 : undefined,
      });
    });
    return 0;
  }

  ttl(key: string): number | undefined {
    const expiresAt = this.read(key)?.expiresAt;
    return expiresAt ? Math.ceil((expiresAt - this.timestamp) / 1_000) : undefined;
  }

  advance(seconds: number) {
    this.timestamp += seconds * 1_000;
  }

  private read(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry?.expiresAt && entry.expiresAt <= this.timestamp) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private throwIfUnavailable() {
    if (this.unavailable) {
      throw new Error("Redis connection refused");
    }
  }
}

describe("lead idempotency", () => {
  const secret = "s".repeat(32);

  it("claims a new key for 24 hours without persisting raw values", async () => {
    const redis = new FakeRedis();
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });

    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).resolves.toMatchObject({
      kind: "claimed",
      token: expect.stringMatching(/^[0-9a-f-]{36}$/u),
    });

    expect(redis.entries).toHaveLength(1);
    const [redisKey, record] = [...redis.entries.entries()][0];
    expect(redisKey).toMatch(/^lead:idempotency:[a-f0-9]{64}$/);
    expect(redisKey).not.toContain("client-key-123");
    expect(record.value).not.toContain("79000000000");
    expect(redis.ttl(redisKey)).toBe(LEAD_IDEMPOTENCY_TTL_SECONDS);
  });

  it("replays a succeeded same-key same-payload submission", async () => {
    const redis = new FakeRedis();
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });

    const claim = await requireClaim(idempotency.claimLead("client-key-123", "phone=79000000000"));
    await idempotency.completeLead("client-key-123", claim.token);

    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).resolves.toEqual({ kind: "replay" });
  });

  it("completes a matching claim atomically and preserves its remaining TTL", async () => {
    const redis = new FakeRedis();
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });
    const claim = await requireClaim(idempotency.claimLead("client-key-123", "phone=79000000000"));
    const [redisKey] = redis.entries.keys();
    redis.advance(90);

    await expect(idempotency.completeLead("client-key-123", claim.token)).resolves.toBe(true);

    expect(redis.ttl(redisKey)).toBe(LEAD_IDEMPOTENCY_TTL_SECONDS - 90);
  });

  it("cannot complete a new claim with a token from an expired predecessor", async () => {
    const redis = new FakeRedis();
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });
    const firstClaim = await requireClaim(idempotency.claimLead("client-key-123", "phone=79000000000"));
    redis.advance(LEAD_IDEMPOTENCY_TTL_SECONDS + 1);
    const replacementClaim = await requireClaim(idempotency.claimLead("client-key-123", "phone=79000000000"));

    await expect(idempotency.completeLead("client-key-123", firstClaim.token)).resolves.toBe(false);
    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).resolves.toEqual({ kind: "processing" });
    expect(replacementClaim.token).not.toBe(firstClaim.token);
  });

  it("releases only the matching retryable claim and never deletes a replacement", async () => {
    const redis = new FakeRedis();
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });
    const firstClaim = await requireClaim(idempotency.claimLead("client-key-123", "phone=79000000000"));

    await expect(idempotency.releaseLead("client-key-123", firstClaim.token)).resolves.toBe(true);
    const replacementClaim = await requireClaim(idempotency.claimLead("client-key-123", "phone=79000000000"));

    await expect(idempotency.releaseLead("client-key-123", firstClaim.token)).resolves.toBe(false);
    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).resolves.toEqual({ kind: "processing" });
    expect(replacementClaim.token).not.toBe(firstClaim.token);
  });

  it("rejects a different payload for an already used key", async () => {
    const redis = new FakeRedis();
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });

    await idempotency.claimLead("client-key-123", "phone=79000000000");

    await expect(idempotency.claimLead("client-key-123", "phone=79990000000")).resolves.toEqual({ kind: "conflict" });
  });

  it("reports an identical in-flight submission as processing", async () => {
    const redis = new FakeRedis();
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });

    await idempotency.claimLead("client-key-123", "phone=79000000000");

    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).resolves.toEqual({ kind: "processing" });
  });

  it("fails closed when Redis is unavailable", async () => {
    const redis = new FakeRedis();
    redis.unavailable = true;
    const idempotency = createLeadIdempotency({ redis, piiHashSecret: secret });

    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).rejects.toMatchObject({
      name: "RedisUnavailableError",
    });
  });

  it("claims a group of Redis markers atomically without a partial write", async () => {
    const redis = new FakeRedis();
    await redis.set("telegram:update:123", "1", { EX: 60 });

    await expect(
      claimRedisKeysOnce(redis, [
        { key: "telegram:update:123", ttlSeconds: 60 },
        { key: "telegram:started:hashed-chat", ttlSeconds: undefined },
      ]),
    ).resolves.toEqual({ kind: "duplicate", duplicateIndex: 0 });
    expect(redis.entries.has("telegram:started:hashed-chat")).toBe(false);
  });

  it("releases a group of Telegram markers only for its matching claim owner", async () => {
    const redis = new FakeRedis();
    const keys = ["telegram:update:123", "telegram:started:hashed-chat"];

    await expect(
      claimRedisKeysOnce(
        redis,
        [
          { key: keys[0], ttlSeconds: 60 },
          { key: keys[1] },
        ],
        "claim-owner",
      ),
    ).resolves.toEqual({ kind: "claimed" });

    await expect(releaseRedisKeysIfOwned(redis, keys, "another-owner")).resolves.toBe(false);
    expect(redis.entries.size).toBe(2);
    await expect(releaseRedisKeysIfOwned(redis, keys, "claim-owner")).resolves.toBe(true);
    expect(redis.entries.size).toBe(0);
  });
});

async function requireClaim(
  result: ReturnType<ReturnType<typeof createLeadIdempotency>["claimLead"]>,
): Promise<{ kind: "claimed"; token: string }> {
  const claim = await result;
  expect(claim.kind).toBe("claimed");
  if (claim.kind !== "claimed") {
    throw new Error("Expected a new idempotency claim");
  }
  expect(claim.token).toMatch(/^[0-9a-f-]{36}$/u);
  return claim as { kind: "claimed"; token: string };
}
