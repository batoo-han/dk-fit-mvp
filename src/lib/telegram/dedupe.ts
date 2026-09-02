import "server-only";

import { claimRedisKeysOnce, getRedisClient } from "../redis/client";
import { hmacFingerprint } from "../security/fingerprint";

const UPDATE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type TelegramDedupeResult = "claimed" | "duplicate_update" | "already_started";

export type TelegramDedupe = {
  claim(updateId: number, chatId: number): Promise<TelegramDedupeResult>;
};

export function createTelegramDedupe(piiHashSecret: string): TelegramDedupe {
  return {
    async claim(updateId, chatId) {
      const redis = await getRedisClient();
      const result = await claimRedisKeysOnce(redis, [
        { key: `telegram:update:${updateId}`, ttlSeconds: UPDATE_TTL_SECONDS },
        { key: `telegram:started:${hmacFingerprint(String(chatId), piiHashSecret)}` },
      ]);

      if (result.kind === "claimed") {
        return "claimed";
      }

      return result.duplicateIndex === 0 ? "duplicate_update" : "already_started";
    },
  };
}
