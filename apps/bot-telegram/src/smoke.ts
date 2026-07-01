import type { ContentItem } from "@subgate/types";
import { buildTelegramBotApp } from "./app.js";
import type { TelegramBotEnv } from "./env.js";
import type { IntegrationSource } from "./subgate-client.js";

const env: TelegramBotEnv = {
  TELEGRAM_BOT_HOST: "127.0.0.1",
  TELEGRAM_BOT_PORT: 3003,
  TELEGRAM_BOT_TOKEN: "telegram-smoke-token",
  TELEGRAM_WEBHOOK_SECRET: "telegram-smoke-secret",
  SUBGATE_API_URL: "http://localhost:3001",
  SUBGATE_WEB_URL: "http://localhost:3000",
  INTERNAL_SERVICE_SECRET: "telegram-smoke-internal-secret",
  DEFAULT_CREATOR_ID: "00000000-0000-4000-8000-000000000001",
  DEFAULT_PRICE_USDC: 0.003,
};
const sentMessages: Array<{ chatId: string | number; text: string }> = [];
const createdContent: ContentItem[] = [];
const boundChannels: IntegrationSource[] = [];
const syncedMappings: Array<{ contentId: string; messageId: number }> = [];
let nextTelegramMessageId = 100;

const app = await buildTelegramBotApp({
  env,
  subgateClient: {
    async createContent(input) {
      const content: ContentItem = {
        id: "00000000-0000-4000-8000-000000000010",
        creatorId: input.creatorId,
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        body: input.body,
        pricing: input.pricing,
        isActive: input.isActive ?? true,
        createdAt: new Date().toISOString(),
      };

      createdContent.push(content);

      return content;
    },
    async getCreatorStats(creatorId) {
      return {
        creatorId,
        contentCount: 1,
        activeContentCount: 1,
        paymentCount: 2,
        settledPaymentCount: 2,
        revenueUsdc: 0.006,
      };
    },
    async listTelegramChannels() {
      return boundChannels;
    },
    async bindTelegramChannel(input) {
      const channel: IntegrationSource = {
        id: "00000000-0000-4000-8000-000000000020",
        creatorId: input.creatorId,
        platform: "telegram",
        externalSourceId: input.chatId,
        name: input.name,
        baseUrl: input.username ? `https://t.me/${input.username}` : null,
        metadata: {
          chatType: input.chatType,
          username: input.username,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      boundChannels.unshift(channel);

      return channel;
    },
    async syncTelegramPublishMapping(input) {
      syncedMappings.push({
        contentId: input.content.id,
        messageId: input.messageId,
      });

      return { ok: true };
    },
  },
  telegramClient: {
    async sendMessage(chatId, text) {
      sentMessages.push({ chatId, text });

      return {
        ok: true,
        result: {
          message_id: nextTelegramMessageId++,
          chat: { id: chatId, type: "channel" },
          text,
        },
      };
    },
  },
});

try {
  const unauthorized = await app.inject({
    method: "POST",
    url: "/webhooks/telegram",
    payload: {},
  });

  if (unauthorized.statusCode !== 401) {
    throw new Error(
      `Expected unsigned Telegram webhook to return 401, received ${unauthorized.statusCode}.`,
    );
  }

  const bindResponse = await app.inject({
    method: "POST",
    url: "/webhooks/telegram",
    headers: {
      "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET ?? "",
    },
    payload: {
      update_id: 1,
      message: {
        message_id: 10,
        chat: {
          id: -1001234567890,
          type: "channel",
          title: "Subgate Smoke",
          username: "subgate_smoke",
        },
        text: "/bind",
      },
    },
  });

  if (bindResponse.statusCode !== 200) {
    throw new Error(
      `Expected bind webhook to return 200, received ${bindResponse.statusCode}.`,
    );
  }

  if (boundChannels.length !== 1) {
    throw new Error("Expected /bind to persist one Telegram channel.");
  }

  const publishResponse = await app.inject({
    method: "POST",
    url: "/webhooks/telegram",
    headers: {
      "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET ?? "",
    },
    payload: {
      update_id: 2,
      message: {
        message_id: 11,
        chat: { id: 1001, type: "private" },
        reply_to_message: {
          message_id: 9,
          chat: { id: 1001, type: "private" },
          text: "Full paid body from a replied draft",
        },
        text: "/publish Alpha memo | 0.003 | A compact paid teaser",
      },
    },
  });

  if (publishResponse.statusCode !== 200) {
    throw new Error(
      `Expected publish webhook to return 200, received ${publishResponse.statusCode}.`,
    );
  }

  if (createdContent.length !== 1) {
    throw new Error("Expected publish command to create one Subgate content item.");
  }

  if (!sentMessages.some((message) => message.chatId === "-1001234567890")) {
    throw new Error("Expected publish command to post teaser to the bound channel.");
  }

  if (!createdContent[0]?.body.includes("replied draft")) {
    throw new Error("Expected publish command to use replied message as paid body.");
  }

  if (syncedMappings.length !== 1) {
    throw new Error("Expected publish command to sync Telegram post mapping.");
  }

  const statsResponse = await app.inject({
    method: "POST",
    url: "/webhooks/telegram",
    headers: {
      "x-telegram-bot-api-secret-token": env.TELEGRAM_WEBHOOK_SECRET ?? "",
    },
    payload: {
      update_id: 3,
      message: {
        message_id: 12,
        chat: { id: 1001, type: "private" },
        text: "/stats",
      },
    },
  });

  if (statsResponse.statusCode !== 200) {
    throw new Error(
      `Expected stats webhook to return 200, received ${statsResponse.statusCode}.`,
    );
  }

  if (!sentMessages.some((message) => message.text.includes("Revenue"))) {
    throw new Error("Expected stats command to reply with creator revenue.");
  }

  console.log(
    "Telegram bot smoke passed: /bind stores a channel; /publish creates content, posts unlock link, and syncs mapping; /stats returns creator sales.",
  );
} finally {
  await app.close();
}
