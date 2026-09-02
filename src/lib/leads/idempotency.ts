import { hmacFingerprint } from "../security/fingerprint";
import { asRedisUnavailable, type RedisStore } from "../redis/client";

import "server-only";

export const LEAD_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

type StoredLeadClaim = {
  version: 1;
  requestFingerprint: string;
  status: "processing" | "succeeded";
};

export type LeadClaimResult =
  | { kind: "claimed" }
  | { kind: "replay" }
  | { kind: "conflict" }
  | { kind: "processing" };

export type LeadIdempotency = {
  claimLead(idempotencyKey: string, requestPayload: string): Promise<LeadClaimResult>;
  completeLead(idempotencyKey: string): Promise<void>;
};

export function createLeadIdempotency({
  redis,
  piiHashSecret,
}: {
  redis: RedisStore;
  piiHashSecret: string;
}): LeadIdempotency {
  const redisKeyFor = (idempotencyKey: string) => `lead:idempotency:${hmacFingerprint(idempotencyKey, piiHashSecret)}`;

  return {
    async claimLead(idempotencyKey, requestPayload) {
      const redisKey = redisKeyFor(idempotencyKey);
      const requestFingerprint = hmacFingerprint(requestPayload, piiHashSecret);
      const record: StoredLeadClaim = { version: 1, requestFingerprint, status: "processing" };

      try {
        // SET NX EX writes the full technical record atomically, so a concurrent retry can
        // never observe an intermediate marker without request/status metadata.
        const write = await redis.set(redisKey, JSON.stringify(record), {
          NX: true,
          EX: LEAD_IDEMPOTENCY_TTL_SECONDS,
        });
        if (write === "OK") {
          return { kind: "claimed" };
        }
      } catch (error) {
        throw asRedisUnavailable(error);
      }

      try {
        const existing = parseStoredClaim(await redis.get(redisKey));
        if (!existing) {
          throw new Error("Idempotency claim disappeared while being read");
        }
        if (existing.requestFingerprint !== requestFingerprint) {
          return { kind: "conflict" };
        }
        return existing.status === "succeeded" ? { kind: "replay" } : { kind: "processing" };
      } catch (error) {
        throw asRedisUnavailable(error);
      }
    },

    async completeLead(idempotencyKey) {
      const redisKey = redisKeyFor(idempotencyKey);
      try {
        const current = parseStoredClaim(await redis.get(redisKey));
        if (!current) {
          throw new Error("Idempotency claim is missing");
        }
        const completed: StoredLeadClaim = { ...current, status: "succeeded" };
        const write = await redis.set(redisKey, JSON.stringify(completed), { XX: true, KEEPTTL: true });
        if (write !== "OK") {
          throw new Error("Idempotency claim disappeared before completion");
        }
      } catch (error) {
        throw asRedisUnavailable(error);
      }
    },
  };
}

function parseStoredClaim(value: string | null): StoredLeadClaim | undefined {
  if (!value) {
    return undefined;
  }
  const candidate: unknown = JSON.parse(value);
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    (candidate as StoredLeadClaim).version !== 1 ||
    !/^[a-f0-9]{64}$/u.test((candidate as StoredLeadClaim).requestFingerprint) ||
    !["processing", "succeeded"].includes((candidate as StoredLeadClaim).status)
  ) {
    throw new Error("Invalid idempotency record");
  }
  return candidate as StoredLeadClaim;
}
