import "server-only";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const SEND_TIMEOUT_MS = 10_000;

export class TelegramDeliveryUnknownError extends Error {
  constructor() {
    super("Telegram delivery outcome is unknown");
    this.name = "TelegramDeliveryUnknownError";
  }
}

export class TelegramDeliveryError extends Error {
  constructor() {
    super("Telegram rejected the message");
    this.name = "TelegramDeliveryError";
  }
}

export async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetchImplementation(`${TELEGRAM_API_BASE_URL}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new TelegramDeliveryError();
    }

    const payload: unknown = await response.json();
    if (!isTelegramSuccess(payload)) {
      throw new TelegramDeliveryUnknownError();
    }
  } catch (error) {
    if (error instanceof TelegramDeliveryError || error instanceof TelegramDeliveryUnknownError) {
      throw error;
    }

    throw new TelegramDeliveryUnknownError();
  } finally {
    clearTimeout(timeout);
  }
}

function isTelegramSuccess(payload: unknown): payload is { ok: true } {
  return typeof payload === "object" && payload !== null && (payload as { ok?: unknown }).ok === true;
}
