import { timingSafeEqual } from "node:crypto";

import "server-only";

import { getServerEnv } from "../../../../lib/config/env";
import {
  sendTelegramMessage,
  TelegramDeliveryError,
  TelegramDeliveryUnknownError,
} from "../../../../lib/telegram/client";
import {
  createTelegramDedupe,
  type TelegramDedupe,
  type TelegramDedupeResult,
} from "../../../../lib/telegram/dedupe";
import { parseStartCommand } from "../../../../lib/telegram/command";

const THANKS_MESSAGE = "Спасибо за регистрацию!";

export const runtime = "nodejs";

export type TelegramWebhookDependencies = {
  botUsername: string;
  webhookSecret: string;
  dedupe: TelegramDedupe;
  sendMessage(chatId: number, text: string): Promise<void>;
  log(event: string): void;
};

type TelegramMessageUpdate = {
  update_id: number;
  message: { chat: { id: number; type: string }; text: string };
};

export function createTelegramWebhookHandler(dependencies: TelegramWebhookDependencies) {
  return async function handleWebhook(request: Request): Promise<Response> {
    if (!hasMatchingSecret(request.headers.get("x-telegram-bot-api-secret-token"), dependencies.webhookSecret)) {
      return new Response(null, { status: 401 });
    }

    const update = await parseUpdate(request);
    if (!update || update.message.chat.type !== "private" || !parseStartCommand(update.message.text, dependencies.botUsername)) {
      return new Response(null, { status: 200 });
    }

    let claim: TelegramDedupeResult;
    try {
      claim = await dependencies.dedupe.claim(update.update_id, update.message.chat.id);
    } catch {
      dependencies.log("telegram_dedupe_unavailable");
      return Response.json({ ok: false, error: "dedupe_unavailable" }, { status: 500 });
    }

    if (claim.kind !== "claimed") {
      return new Response(null, { status: 200 });
    }

    try {
      await dependencies.sendMessage(update.message.chat.id, THANKS_MESSAGE);
      return new Response(null, { status: 200 });
    } catch (error) {
      if (error instanceof TelegramDeliveryUnknownError) {
        dependencies.log("telegram_delivery_unknown");
        return Response.json({ ok: false, error: "delivery_unknown" }, { status: 500 });
      }

      if (error instanceof TelegramDeliveryError) {
        try {
          const released = await dependencies.dedupe.release(
            update.update_id,
            update.message.chat.id,
            claim.token,
          );
          dependencies.log(released ? "telegram_delivery_failed" : "telegram_dedupe_release_conflict");
        } catch {
          dependencies.log("telegram_dedupe_release_unavailable");
        }
        return Response.json({ ok: false, error: "delivery_failed" }, { status: 500 });
      }

      dependencies.log("telegram_delivery_failed");
      return Response.json({ ok: false, error: "delivery_failed" }, { status: 500 });
    }
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const env = getServerEnv();
    const handler = createTelegramWebhookHandler({
      botUsername: env.telegram.username,
      webhookSecret: env.telegram.webhookSecret,
      dedupe: createTelegramDedupe(env.piiHashSecret),
      sendMessage: (chatId, text) => sendTelegramMessage(env.telegram.apiBaseUrl, env.telegram.token, chatId, text),
      log: (event) => console.error(event),
    });

    return handler(request);
  } catch {
    return Response.json({ ok: false, error: "configuration_error" }, { status: 500 });
  }
}

function hasMatchingSecret(presented: string | null, expected: string): boolean {
  const expectedBytes = Buffer.from(expected);
  if (presented === null) {
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }

  const presentedBytes = Buffer.from(presented);
  if (presentedBytes.length !== expectedBytes.length) {
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }

  return timingSafeEqual(presentedBytes, expectedBytes);
}

async function parseUpdate(request: Request): Promise<TelegramMessageUpdate | null> {
  try {
    const payload: unknown = await request.json();
    if (!isTelegramMessageUpdate(payload)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function isTelegramMessageUpdate(payload: unknown): payload is TelegramMessageUpdate {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const update = payload as {
    update_id?: unknown;
    message?: { chat?: { id?: unknown; type?: unknown }; text?: unknown };
  };

  return (
    typeof update.update_id === "number" &&
    Number.isSafeInteger(update.update_id) &&
    typeof update.message?.chat?.id === "number" &&
    Number.isSafeInteger(update.message.chat.id) &&
    typeof update.message.chat.type === "string" &&
    typeof update.message.text === "string"
  );
}
