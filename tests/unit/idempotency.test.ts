import { describe, expect, it } from "vitest";

import {
  LEAD_IDEMPOTENCY_TTL_SECONDS,
  createLeadIdempotency,
} from "../../src/lib/leads/idempotency";
import { claimRedisKeysOnce, type RedisStore } from "../../src/lib/redis/client";

type Entry = { value: string; expiresAt?: number };

class FakeRedis implements RedisStore {
  readonly entries = new Map<string, Entry>();
  unavailable = false;

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
      expiresAt: options?.EX ? Date.now() + options.EX * 1_000 : options?.KEEPTTL ? current?.expiresAt : undefined,
    });
    return "OK";
  }

  async incr(key: string): Promise<number> {
    this.throwIfUnavailable();
    const value = Number(this.read(key)?.value ?? "0") + 1;
    this.entries.set(key, { value: String(value), expiresAt: this.read(key)?.expiresAt });
    return value;
  }

  async eval(_script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown> {
    this.throwIfUnavailable();
    const duplicateIndex = options.keys.findIndex((key) => this.read(key));
    if (duplicateIndex >= 0) {
      return duplicateIndex + 1;
    }
    options.keys.forEach((key, index) => {
      const ttlSeconds = Number(options.arguments[index]);
      this.entries.set(key, { value: "1", expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1_000 : undefined });
    });
    return 0;
  }

  ttl(key: string): number | undefined {
    const expiresAt = this.read(key)?.expiresAt;
    return expiresAt ? Math.round((expiresAt - Date.now()) / 1_000) : undefined;
  }

  private read(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
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

    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).resolves.toEqual({ kind: "claimed" });

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

    await idempotency.claimLead("client-key-123", "phone=79000000000");
    await idempotency.completeLead("client-key-123");

    await expect(idempotency.claimLead("client-key-123", "phone=79000000000")).resolves.toEqual({ kind: "replay" });
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
});
