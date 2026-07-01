import Fastify from "fastify";
import type { TelegramBotEnv } from "./env.js";
import { handleTelegramMessage } from "./commands.js";
import { SubgateClient } from "./subgate-client.js";
import { TelegramClient, type TelegramUpdate } from "./telegram-client.js";

export type BuildTelegramBotAppOptions = {
  env: TelegramBotEnv;
  subgateClient?: Pick<SubgateClient, "createContent" | "getCreatorStats">;
  telegramClient?: Pick<TelegramClient, "sendMessage">;
};

export const buildTelegramBotApp = async ({
  env,
  subgateClient,
  telegramClient,
}: BuildTelegramBotAppOptions) => {
  const app = Fastify({
    logger: true,
  });
  const subgate =
    subgateClient ??
    new SubgateClient({
      apiUrl: env.SUBGATE_API_URL,
      internalServiceSecret: env.INTERNAL_SERVICE_SECRET,
    });
  const telegram =
    telegramClient ??
    new TelegramClient({
      botToken: env.TELEGRAM_BOT_TOKEN,
    });

  app.get("/health", async () => {
    return {
      service: "bot-telegram",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  });

  app.post("/webhooks/telegram", async (request, reply) => {
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const providedSecret = request.headers["x-telegram-bot-api-secret-token"];
      const secret = Array.isArray(providedSecret)
        ? providedSecret[0]
        : providedSecret;

      if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return reply.code(401).send({
          message: "Invalid Telegram webhook credentials.",
        });
      }
    }

    const update = request.body as TelegramUpdate;

    if (update.message) {
      await handleTelegramMessage(update.message, {
        env,
        subgate,
        telegram,
      });
    }

    return {
      ok: true,
    };
  });

  return app;
};
