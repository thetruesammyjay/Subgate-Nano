import { loadTelegramBotEnv } from "./env.js";
import { TelegramClient } from "./telegram-client.js";

const command = process.argv[2] ?? "info";
const env = loadTelegramBotEnv();
const telegram = new TelegramClient({
  botToken: env.TELEGRAM_BOT_TOKEN,
});

const printWebhookInfo = async () => {
  const info = await telegram.getWebhookInfo();
  const result = info.result;

  console.log("Telegram webhook");
  console.log(`URL: ${result.url || "(not set)"}`);
  console.log(`Pending updates: ${result.pending_update_count}`);

  if (result.last_error_message) {
    console.log(`Last error: ${result.last_error_message}`);
  }
};

switch (command) {
  case "set": {
    if (!env.TELEGRAM_WEBHOOK_URL) {
      throw new Error("TELEGRAM_WEBHOOK_URL is required for webhook:set.");
    }

    const result = await telegram.setWebhook({
      url: env.TELEGRAM_WEBHOOK_URL,
      ...(env.TELEGRAM_WEBHOOK_SECRET
        ? { secretToken: env.TELEGRAM_WEBHOOK_SECRET }
        : {}),
    });

    console.log(result.description ?? "Telegram webhook set.");
    await printWebhookInfo();
    break;
  }
  case "delete": {
    const result = await telegram.deleteWebhook();

    console.log(result.description ?? "Telegram webhook deleted.");
    await printWebhookInfo();
    break;
  }
  case "info":
    await printWebhookInfo();
    break;
  default:
    throw new Error(
      `Unknown webhook command "${command}". Use set, info, or delete.`,
    );
}
