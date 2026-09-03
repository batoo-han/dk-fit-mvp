import { describe, expect, it, vi } from "vitest";

import {
  createTelegramWebhookHandler,
  type TelegramWebhookDependencies,
} from "../../src/app/api/telegram/webhook/route";
import {
  TelegramDeliveryError,
  TelegramDeliveryUnknownError,
} from "../../src/lib/telegram/client";

const WEBHOOK_SECRET = "s".repeat(32);
const CLAIM_TOKEN = "00000000-0000-4000-8000-000000000000";

function startUpdate(updateId = 101, chatId = 42) {
  return {
    update_id: updateId,
    message: {
      chat: { id: chatId, type: "private" },
      text: "/start registered",
    },
  };
}

function handlerWith(overrides: Partial<TelegramWebhookDependencies> = {}) {
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const dependencies: TelegramWebhookDependencies = {
    botUsername: "test_bot",
    webhookSecret: WEBHOOK_SECRET,
    dedupe: {
      claim: vi.fn().mockResolvedValue({ kind: "claimed", token: CLAIM_TOKEN }),
      release: vi.fn().mockResolvedValue(true),
    },
    sendMessage,
    log: vi.fn(),
    ...overrides,
  };

  return { handler: createTelegramWebhookHandler(dependencies), dependencies, sendMessage };
}

function webhookRequest(update: object, secret: string | null = WEBHOOK_SECRET) {
  return new Request("https://dk-fit.test/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}),
    },
    body: JSON.stringify(update),
  });
}

describe("POST /api/telegram/webhook", () => {
  it.each([null, "wrong-secret"])('rejects a missing or invalid secret', async (secret) => {
    const { handler, sendMessage } = handlerWith();

    const response = await handler(webhookRequest(startUpdate(), secret));

    expect(response.status).toBe(401);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends the exact thanks once for the first private Start", async () => {
    const { handler, sendMessage } = handlerWith();

    const response = await handler(webhookRequest(startUpdate()));

    expect(response.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(42, "Спасибо за регистрацию!");
  });

  it("does not resend for an already-claimed update", async () => {
    const { handler, sendMessage } = handlerWith({
      dedupe: {
        claim: vi.fn().mockResolvedValue({ kind: "duplicate_update" }),
        release: vi.fn().mockResolvedValue(false),
      },
    });

    const response = await handler(webhookRequest(startUpdate()));

    expect(response.status).toBe(200);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not send another thanks for a new Start from an already-thanked chat", async () => {
    const { handler, sendMessage } = handlerWith({
      dedupe: {
        claim: vi.fn().mockResolvedValue({ kind: "already_started" }),
        release: vi.fn().mockResolvedValue(false),
      },
    });

    const response = await handler(webhookRequest(startUpdate(102)));

    expect(response.status).toBe(200);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores non-Start, group and non-message updates", async () => {
    const { handler, dependencies, sendMessage } = handlerWith();
    const requests = [
      webhookRequest({ ...startUpdate(), message: { chat: { id: 42, type: "private" }, text: "/help" } }),
      webhookRequest({ ...startUpdate(), message: { chat: { id: 42, type: "group" }, text: "/start" } }),
      webhookRequest({ update_id: 102, edited_message: startUpdate().message }),
    ];

    for (const request of requests) {
      expect((await handler(request)).status).toBe(200);
    }

    expect(dependencies.dedupe.claim).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("releases a definite Telegram rejection so the same update can be retried", async () => {
    const dedupe = statefulDedupe();
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new TelegramDeliveryError())
      .mockResolvedValueOnce(undefined);
    const { handler } = handlerWith({ dedupe, sendMessage });

    const firstResponse = await handler(webhookRequest(startUpdate(103, 987654)));
    const retryResponse = await handler(webhookRequest(startUpdate(103, 987654)));

    expect(firstResponse.status).toBe(500);
    await expect(firstResponse.json()).resolves.toEqual({ ok: false, error: "delivery_failed" });
    expect(retryResponse.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(dedupe.release).toHaveBeenCalledOnce();
  });

  it("releases a definite Telegram rejection so a new Start from the same chat can succeed", async () => {
    const dedupe = statefulDedupe();
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new TelegramDeliveryError())
      .mockResolvedValueOnce(undefined);
    const { handler } = handlerWith({ dedupe, sendMessage });

    const firstResponse = await handler(webhookRequest(startUpdate(104, 987654)));
    const newStartResponse = await handler(webhookRequest(startUpdate(105, 987654)));

    expect(firstResponse.status).toBe(500);
    expect(newStartResponse.status).toBe(200);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(dedupe.release).toHaveBeenCalledOnce();
  });

  it("keeps dedupe markers for an unknown delivery outcome without logging the raw update", async () => {
    const log = vi.fn();
    const dedupe = statefulDedupe();
    const timeoutSendMessage = vi.fn().mockRejectedValue(new TelegramDeliveryUnknownError());
    const { handler } = handlerWith({
      dedupe,
      log,
      sendMessage: timeoutSendMessage,
    });

    const response = await handler(webhookRequest(startUpdate(103, 987654)));
    const newStartResponse = await handler(webhookRequest(startUpdate(104, 987654)));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "delivery_unknown" });
    expect(newStartResponse.status).toBe(200);
    expect(timeoutSendMessage).toHaveBeenCalledOnce();
    expect(dedupe.release).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain("987654");
    expect(JSON.stringify(log.mock.calls)).not.toContain("/start registered");
  });
});

function statefulDedupe(): TelegramWebhookDependencies["dedupe"] & { release: ReturnType<typeof vi.fn> } {
  const updates = new Map<number, string>();
  const chats = new Map<number, string>();
  let claimSequence = 0;

  return {
    claim: vi.fn(async (updateId: number, chatId: number) => {
      if (updates.has(updateId)) {
        return { kind: "duplicate_update" } as const;
      }
      if (chats.has(chatId)) {
        return { kind: "already_started" } as const;
      }

      const token = `claim-${claimSequence += 1}`;
      updates.set(updateId, token);
      chats.set(chatId, token);
      return { kind: "claimed", token } as const;
    }),
    release: vi.fn(async (updateId: number, chatId: number, token: string) => {
      if (updates.get(updateId) !== token || chats.get(chatId) !== token) {
        return false;
      }
      updates.delete(updateId);
      chats.delete(chatId);
      return true;
    }),
  };
}
