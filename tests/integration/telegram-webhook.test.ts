import { describe, expect, it, vi } from "vitest";

import {
  TelegramDeliveryUnknownError,
  createTelegramWebhookHandler,
  type TelegramWebhookDependencies,
} from "../../src/app/api/telegram/webhook/route";

const WEBHOOK_SECRET = "s".repeat(32);

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
      claim: vi.fn().mockResolvedValue("claimed"),
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
      dedupe: { claim: vi.fn().mockResolvedValue("duplicate_update") },
    });

    const response = await handler(webhookRequest(startUpdate()));

    expect(response.status).toBe(200);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not send another thanks for a new Start from an already-thanked chat", async () => {
    const { handler, sendMessage } = handlerWith({
      dedupe: { claim: vi.fn().mockResolvedValue("already_started") },
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

  it("returns an explicit retry-safe unknown state after a Telegram timeout without logging the raw update", async () => {
    const log = vi.fn();
    const timeoutSendMessage = vi.fn().mockRejectedValue(new TelegramDeliveryUnknownError());
    const { handler, sendMessage } = handlerWith({
      log,
      sendMessage: timeoutSendMessage,
    });

    const response = await handler(webhookRequest(startUpdate(103, 987654)));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "delivery_unknown" });
    expect(timeoutSendMessage).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain("987654");
    expect(JSON.stringify(log.mock.calls)).not.toContain("/start registered");
  });
});
