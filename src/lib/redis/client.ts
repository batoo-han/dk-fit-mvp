import { createClient } from "redis";

import { getServerEnv } from "../config/env";

import "server-only";

export type RedisSetOptions = {
  EX?: number;
  NX?: true;
  XX?: true;
  KEEPTTL?: true;
};

export interface RedisStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: RedisSetOptions): Promise<"OK" | null>;
  incr(key: string): Promise<number>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export class RedisUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Redis is unavailable", { cause });
    this.name = "RedisUnavailableError";
  }
}

let sharedClientPromise: Promise<RedisStore> | undefined;

export async function getRedisClient(): Promise<RedisStore> {
  if (!sharedClientPromise) {
    sharedClientPromise = connectRedis(getServerEnv().redisUrl);
  }

  try {
    return await sharedClientPromise;
  } catch (error) {
    sharedClientPromise = undefined;
    throw asRedisUnavailable(error);
  }
}

async function connectRedis(url: string): Promise<RedisStore> {
  const client = createClient({ url });
  client.on("error", () => undefined);

  try {
    await client.connect();
    return client as unknown as RedisStore;
  } catch (error) {
    client.destroy();
    throw asRedisUnavailable(error);
  }
}

export function asRedisUnavailable(error: unknown): RedisUnavailableError {
  return error instanceof RedisUnavailableError ? error : new RedisUnavailableError(error);
}

export async function claimRedisKeyOnce(redis: RedisStore, key: string, ttlSeconds?: number): Promise<boolean> {
  try {
    const options: RedisSetOptions = ttlSeconds === undefined ? { NX: true } : { NX: true, EX: ttlSeconds };
    return (await redis.set(key, "1", options)) === "OK";
  } catch (error) {
    throw asRedisUnavailable(error);
  }
}

export type RedisKeyClaim = { key: string; ttlSeconds?: number };
export type RedisKeysClaimResult = { kind: "claimed" } | { kind: "duplicate"; duplicateIndex: number };

const CLAIM_KEYS_ONCE_SCRIPT = `
local claimValue = ARGV[#KEYS + 1]
for index, key in ipairs(KEYS) do
  if redis.call("EXISTS", key) == 1 then
    return index
  end
end
for index, key in ipairs(KEYS) do
  local ttl = tonumber(ARGV[index])
  if ttl > 0 then
    redis.call("SET", key, claimValue, "EX", ttl)
  else
    redis.call("SET", key, claimValue)
  end
end
return 0
`;

export async function claimRedisKeysOnce(
  redis: RedisStore,
  claims: readonly RedisKeyClaim[],
  claimValue = "1",
): Promise<RedisKeysClaimResult> {
  if (claims.length === 0) {
    throw new Error("At least one Redis key is required");
  }
  if (new Set(claims.map((claim) => claim.key)).size !== claims.length) {
    throw new Error("Redis key claims must be unique");
  }

  try {
    const reply = await redis.eval(CLAIM_KEYS_ONCE_SCRIPT, {
      keys: claims.map((claim) => claim.key),
      arguments: [...claims.map((claim) => String(claim.ttlSeconds ?? 0)), claimValue],
    });
    const duplicateIndex = Number(reply);

    if (!Number.isInteger(duplicateIndex) || duplicateIndex < 0 || duplicateIndex > claims.length) {
      throw new Error("Unexpected Redis claim response");
    }

    return duplicateIndex === 0 ? { kind: "claimed" } : { kind: "duplicate", duplicateIndex: duplicateIndex - 1 };
  } catch (error) {
    throw asRedisUnavailable(error);
  }
}

const RELEASE_KEYS_IF_OWNED_SCRIPT = `
local claimOwner = ARGV[1]
for _, key in ipairs(KEYS) do
  if redis.call("GET", key) ~= claimOwner then
    return 0
  end
end
redis.call("DEL", unpack(KEYS))
return 1
`;

export async function releaseRedisKeysIfOwned(
  redis: RedisStore,
  keys: readonly string[],
  claimOwner: string,
): Promise<boolean> {
  if (keys.length === 0 || new Set(keys).size !== keys.length || claimOwner.length === 0) {
    throw new Error("Unique Redis keys and a claim owner are required");
  }

  try {
    const reply = await redis.eval(RELEASE_KEYS_IF_OWNED_SCRIPT, {
      keys: [...keys],
      arguments: [claimOwner],
    });
    if (reply !== 0 && reply !== 1 && reply !== "0" && reply !== "1") {
      throw new Error("Unexpected Redis release response");
    }
    return Number(reply) === 1;
  } catch (error) {
    throw asRedisUnavailable(error);
  }
}
