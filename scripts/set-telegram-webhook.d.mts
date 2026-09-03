export function setTelegramWebhook(options: {
  environment: Record<string, string | undefined>;
  request?: typeof fetch;
}): Promise<{ endpoint: string; status: number }>;
