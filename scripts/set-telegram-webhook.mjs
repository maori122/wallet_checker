/**
 * Register Telegram webhook for the Cloudflare Worker.
 * Requires the SAME values as in Worker secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET.
 *
 * Usage (PowerShell):
 *   $env:TELEGRAM_BOT_TOKEN="123456:ABC..."; $env:TELEGRAM_WEBHOOK_SECRET="your-secret"; node scripts/set-telegram-webhook.mjs
 */
const DEFAULT_WEBHOOK_URL = "https://wallet.101avatartanki101.workers.dev/webhook/telegram";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.env.TELEGRAM_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;

if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET (must match Cloudflare secrets).");
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}/setWebhook`;
const res = await fetch(api, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret
  })
});
const data = await res.json();
if (!res.ok || !data.ok) {
  console.error("setWebhook failed:", res.status, data);
  process.exit(1);
}
console.log("setWebhook ok:", data.description || data);

const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const info = await infoRes.json();
console.log("getWebhookInfo:", JSON.stringify(info, null, 2));
