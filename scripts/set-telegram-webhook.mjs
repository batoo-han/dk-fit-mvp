const requiredEnvironmentNames = [
  "PUBLIC_SITE_URL",
  "TELEGRAM_BOT_API_BASE_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
];

export async function setTelegramWebhook({ environment = process.env, request = fetch } = {}) {
  const missing = requiredEnvironmentNames.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const siteUrl = requireHttpsUrl(environment.PUBLIC_SITE_URL, "PUBLIC_SITE_URL");
  const apiBaseUrl = requireHttpsUrl(environment.TELEGRAM_BOT_API_BASE_URL, "TELEGRAM_BOT_API_BASE_URL");
  apiBaseUrl.pathname = `${apiBaseUrl.pathname.replace(/\/+$/u, "")}/`;
  const webhookUrl = new URL("/api/telegram/webhook", siteUrl).href;
  const response = await request(
    `${apiBaseUrl.href}bot${environment.TELEGRAM_BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: environment.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ["message"],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Telegram webhook setup failed with status ${response.status}`);
  }

  return { endpoint: webhookUrl, status: response.status };
}

function requireHttpsUrl(value, key) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error("Unsafe URL");
    }
    return url;
  } catch {
    throw new Error(`${key} must use HTTPS`);
  }
}

async function main() {
  try {
    const result = await setTelegramWebhook();
    console.log(`Telegram webhook configured: ${result.endpoint} (status ${result.status})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Telegram webhook setup request failed");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await main();
}
