import { buildTelegramBotApp } from "./app.js";
import { loadTelegramBotEnv } from "./env.js";
import { loadTelegramBotLocalEnvFiles } from "./local-env.js";

loadTelegramBotLocalEnvFiles();
const env = loadTelegramBotEnv();
const app = await buildTelegramBotApp({ env });

const start = async () => {
  try {
    await app.listen({
      port: env.TELEGRAM_BOT_PORT,
      host: env.TELEGRAM_BOT_HOST,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
