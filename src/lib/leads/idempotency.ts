import { randomUUID } from "node:crypto";

import { hmacFingerprint } from "../security/fingerprint";
import { asRedisUnavailable, type RedisStore } from "../redis/client";

import "server-only";

export const LEAD_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

type StoredLeadClaim = {
  version: 1;
  requestFingerprint: string;
  claimToken: string;
  status: "processing" | "succeeded";
};

export type LeadClaimResult =
  | { kind: "claimed"; token: string }
  | { kind: "replay" }
  | { kind: "conflict" }
  | { kind: "processing" };

export type LeadIdempotency = {
  claimLead(idempotencyKey: string, requestPayload: string): Promise<LeadClaimResult>;
  completeLead(idempotencyKey: string, claimToken: string): Promise<boolean>;
  releaseLead(idempotencyKey: string, claimToken: string): Promise<boolean>;
};

const COMPLETE_LEAD_CLAIM_SCRIPT = `
local encoded = redis.call("GET", KEYS[1])
if not encoded then
  return 0
end
local record = cjson.decode(encoded)
if record.status ~= "processing" or record.claimToken ~= ARGV[1] then
  return 0
end
record.status = "succeeded"
redis.call("SET", KEYS[1], cjson.encode(record), "XX", "KEEPTTL")
return 1
`;

const RELEASE_LEAD_CLAIM_SCRIPT = `
local encoded = redis.call("GET", KEYS[1])
if not encoded then
  return 0
end
local record = cjson.decode(encoded)
if record.status ~= "processing" or record.claimToken ~= ARGV[1] then
  return 0
end
redis.call("DEL", KEYS[1])
return 1
`;

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
      const record: StoredLeadClaim = {
        version: 1,
        requestFingerprint,
        claimToken: randomUUID(),
        status: "processing",
      };

      try {
        // SET NX EX writes the full technical record atomically, so a concurrent retry can
        // never observe an intermediate marker without request/status metadata.
        const write = await redis.set(redisKey, JSON.stringify(record), {
          NX: true,
          EX: LEAD_IDEMPOTENCY_TTL_SECONDS,
        });
        if (write === "OK") {
          return { kind: "claimed", token: record.claimToken };
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

    async completeLead(idempotencyKey, claimToken) {
      return transitionLeadClaim(redis, COMPLETE_LEAD_CLAIM_SCRIPT, redisKeyFor(idempotencyKey), claimToken);
    },

    async releaseLead(idempotencyKey, claimToken) {
      return transitionLeadClaim(redis, RELEASE_LEAD_CLAIM_SCRIPT, redisKeyFor(idempotencyKey), claimToken);
    },
  };
}

async function transitionLeadClaim(
  redis: RedisStore,
  script: string,
  redisKey: string,
  claimToken: string,
): Promise<boolean> {
  try {
    const result = Number(await redis.eval(script, { keys: [redisKey], arguments: [claimToken] }));
    if (result !== 0 && result !== 1) {
      throw new Error("Unexpected Redis lead claim transition response");
    }
    return result === 1;
  } catch (error) {
    throw asRedisUnavailable(error);
  }
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
    !/^[0-9a-f-]{36}$/u.test((candidate as StoredLeadClaim).claimToken) ||
    !["processing", "succeeded"].includes((candidate as StoredLeadClaim).status)
  ) {
    throw new Error("Invalid idempotency record");
  }
  return candidate as StoredLeadClaim;
}
