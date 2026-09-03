import { describe, expect, it, vi } from "vitest";

import { sendTelegramMessage } from "../../src/lib/telegram/client";

describe("Telegram Bot API client", () => {
  it("sends messages through the configured Bot API proxy base URL", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }),
    );

    await sendTelegramMessage(
      new URL("https://telegram-proxy.test/tg/"),
      "123:fixture-token",
      42,
      "Спасибо за регистрацию!",
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://telegram-proxy.test/tg/bot123:fixture-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
