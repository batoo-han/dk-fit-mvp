import { describe, expect, it, vi } from "vitest";

import { setTelegramWebhook } from "../../scripts/set-telegram-webhook.mjs";

describe("set Telegram webhook", () => {
  it("uses the configured Bot API proxy without exposing credentials", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await setTelegramWebhook({
      environment: {
        PUBLIC_SITE_URL: "https://dk-fit.test",
        TELEGRAM_BOT_API_BASE_URL: "https://telegram-proxy.test/tg/",
        TELEGRAM_BOT_TOKEN: "123:fixture-token",
        TELEGRAM_WEBHOOK_SECRET: "fixture-secret",
      },
      request,
    });

    expect(result).toEqual({ endpoint: "https://dk-fit.test/api/telegram/webhook", status: 200 });
    expect(request).toHaveBeenCalledWith(
      "https://telegram-proxy.test/tg/bot123:fixture-token/setWebhook",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
