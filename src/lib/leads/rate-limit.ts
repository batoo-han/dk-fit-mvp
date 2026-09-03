import type { LeadClaimResult } from "./idempotency";
import { asRedisUnavailable, type RedisStore } from "../redis/client";
import { fingerprintIp, fingerprintPhone } from "../security/fingerprint";

import "server-only";

const RATE_INCREMENT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;

type RateLimitScope = "ip:10m" | "ip:1d" | "phone:1h" | "phone:1d";
type RateLimitResult = { allowed: true; charged: boolean } | { allowed: false; charged: true; scope: RateLimitScope };

type LeadRateLimitSubject = { ip: string; phone: string };
type TimeSource = () => number;

export type LeadRateLimiter = {
  checkLeadRateLimit(subject: LeadRateLimitSubject, claim: LeadClaimResult): Promise<RateLimitResult>;
};

export function createLeadRateLimiter({
  redis,
  piiHashSecret,
  now = Date.now,
}: {
  redis: RedisStore;
  piiHashSecret: string;
  now?: TimeSource;
}): LeadRateLimiter {
  return {
    async checkLeadRateLimit(subject, claim) {
      if (claim.kind === "replay") {
        return { allowed: true, charged: false };
      }
      if (claim.kind !== "claimed") {
        throw new Error("Only a newly claimed lead may be rate-limited");
      }

      const timestamp = now();
      const ipFingerprint = fingerprintIp(subject.ip, piiHashSecret);
      const phoneFingerprint = fingerprintPhone(subject.phone, piiHashSecret);
      const limits: Array<{ scope: RateLimitScope; key: string; max: number; ttlSeconds: number }> = [
        rateWindow("ip:10m", `lead:rate:ip:${ipFingerprint}`, timestamp, 10 * 60 * 1_000, 5),
        rateWindow("ip:1d", `lead:rate:ip:${ipFingerprint}`, timestamp, 24 * 60 * 60 * 1_000, 30),
        rateWindow("phone:1h", `lead:rate:phone:${phoneFingerprint}`, timestamp, 60 * 60 * 1_000, 3),
        rateWindow("phone:1d", `lead:rate:phone:${phoneFingerprint}`, timestamp, 24 * 60 * 60 * 1_000, 5),
      ];

      for (const limit of limits) {
        if ((await incrementWindow(redis, limit.key, limit.ttlSeconds)) > limit.max) {
          return { allowed: false, charged: true, scope: limit.scope };
        }
      }
      return { allowed: true, charged: true };
    },
  };
}

function rateWindow(
  scope: RateLimitScope,
  keyPrefix: string,
  timestamp: number,
  durationMs: number,
  max: number,
): { scope: RateLimitScope; key: string; max: number; ttlSeconds: number } {
  const window = Math.floor(timestamp / durationMs);
  const windowEnd = (window + 1) * durationMs;
  return {
    scope,
    key: `${keyPrefix}:${scope.split(":")[1]}:${window}`,
    max,
    ttlSeconds: Math.max(1, Math.ceil((windowEnd - timestamp) / 1_000)),
  };
}

async function incrementWindow(redis: RedisStore, key: string, ttlSeconds: number): Promise<number> {
  try {
    const value = await redis.eval(RATE_INCREMENT_SCRIPT, { keys: [key], arguments: [String(ttlSeconds)] });
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) {
      throw new Error("Unexpected Redis rate counter response");
    }
    return count;
  } catch (error) {
    throw asRedisUnavailable(error);
  }
}
