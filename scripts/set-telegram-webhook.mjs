const requiredEnvironmentNames = [
  "PUBLIC_SITE_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
];

const missing = requiredEnvironmentNames.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  const siteUrl = new URL(process.env.PUBLIC_SITE_URL);
  if (siteUrl.protocol !== "https:") {
    console.error("PUBLIC_SITE_URL must use HTTPS to configure Telegram webhook");
    process.exitCode = 1;
  } else {
    const webhookUrl = new URL("/api/telegram/webhook", siteUrl).href;
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
            allowed_updates: ["message"],
          }),
        },
      );

      if (!response.ok) {
        console.error(`Telegram webhook setup failed with status ${response.status}`);
        process.exitCode = 1;
      } else {
        console.log(`Telegram webhook configured: ${webhookUrl} (status ${response.status})`);
      }
    } catch {
      console.error("Telegram webhook setup request failed");
      process.exitCode = 1;
    }
  }
}
