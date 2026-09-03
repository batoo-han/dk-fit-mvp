import { randomUUID } from "node:crypto";

import "server-only";

import {
  claimRedisKeysOnce,
  getRedisClient,
  releaseRedisKeysIfOwned,
} from "../redis/client";
import { hmacFingerprint } from "../security/fingerprint";

const UPDATE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type TelegramDedupeResult =
  | { kind: "claimed"; token: string }
  | { kind: "duplicate_update" }
  | { kind: "already_started" };

export type TelegramDedupe = {
  claim(updateId: number, chatId: number): Promise<TelegramDedupeResult>;
  release(updateId: number, chatId: number, token: string): Promise<boolean>;
};

export function createTelegramDedupe(piiHashSecret: string): TelegramDedupe {
  return {
    async claim(updateId, chatId) {
      const redis = await getRedisClient();
      const token = randomUUID();
      const result = await claimRedisKeysOnce(redis, telegramKeys(updateId, chatId, piiHashSecret), token);

      if (result.kind === "claimed") {
        return { kind: "claimed", token };
      }

      return result.duplicateIndex === 0 ? { kind: "duplicate_update" } : { kind: "already_started" };
    },
    async release(updateId, chatId, token) {
      const redis = await getRedisClient();
      return releaseRedisKeysIfOwned(
        redis,
        telegramKeys(updateId, chatId, piiHashSecret).map(({ key }) => key),
        token,
      );
    },
  };
}

function telegramKeys(updateId: number, chatId: number, piiHashSecret: string) {
  return [
    { key: `telegram:update:${updateId}`, ttlSeconds: UPDATE_TTL_SECONDS },
    { key: `telegram:started:${hmacFingerprint(String(chatId), piiHashSecret)}` },
  ];
}
