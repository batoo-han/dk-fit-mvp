import { describe, expect, it } from "vitest";

import { parseStartCommand } from "../../src/lib/telegram/command";
import { buildTelegramDeepLink } from "../../src/lib/telegram/deep-link";

describe("Telegram registration command", () => {
  it.each(["/start", "/start registered", "/start@test_bot registered"])(
    "accepts supported Start form %s",
    (text) => {
      expect(parseStartCommand(text, "test_bot")).toBe(true);
    },
  );

  it.each(["/help", "/start other", "/start@other_bot registered", "hello", " /start"])(
    "rejects non-registration text %s",
    (text) => {
      expect(parseStartCommand(text, "test_bot")).toBe(false);
    },
  );

  it("builds the fixed PII-free registration deep link", () => {
    const link = buildTelegramDeepLink("test_bot");

    expect(link).toBe("https://t.me/test_bot?start=registered");
    expect(link).not.toMatch(/name|phone|chat/i);
  });
});
