import { createContentInputSchema, type ContentItem } from "@subgate/types";
import type { TelegramBotEnv } from "./env.js";
import type { CreatorStats, SubgateClient } from "./subgate-client.js";
import type { TelegramChatId, TelegramClient, TelegramMessage } from "./telegram-client.js";

export type BotServices = {
  env: TelegramBotEnv;
  subgate: Pick<SubgateClient, "createContent" | "getCreatorStats">;
  telegram: Pick<TelegramClient, "sendMessage">;
};

type PublishCommand = {
  title: string;
  priceUsdc: number;
  summary: string;
  body: string;
};

const helpText = [
  "Subgate Nano creator bot",
  "",
  "Publish a paid drop:",
  "/publish",
  "Title",
  "0.003",
  "Short teaser summary",
  "Full paid content body",
  "",
  "Or use one line:",
  "/publish Title | 0.003 | Short summary | Full paid body",
  "",
  "View sales:",
  "/stats",
].join("\n");

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "telegram-drop";
};

const formatUsdc = (value: number) => {
  return `$${value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} USDC`;
};

const trimCommand = (text: string, command: string) => {
  return text.replace(new RegExp(`^/${command}(?:@\\w+)?`, "i"), "").trim();
};

const parsePublishCommand = (
  text: string,
  defaultPriceUsdc: number,
): PublishCommand | null => {
  const body = trimCommand(text, "publish");

  if (!body) {
    return null;
  }

  const parts = body.includes("|")
    ? body.split("|").map((part) => part.trim())
    : body.split(/\r?\n/).map((part) => part.trim());
  const [title, rawPrice, summary, ...bodyParts] = parts;
  const priceUsdc = rawPrice ? Number(rawPrice) : defaultPriceUsdc;
  const paidBody = bodyParts.join("\n").trim();

  if (!title || !summary || !paidBody || !Number.isFinite(priceUsdc)) {
    return null;
  }

  return {
    title,
    priceUsdc,
    summary,
    body: paidBody,
  };
};

const buildUnlockUrl = (webUrl: string, slug: string) => {
  return new URL(`/content/${encodeURIComponent(slug)}`, `${webUrl.replace(/\/$/, "")}/`).toString();
};

const buildTeaser = (content: ContentItem, unlockUrl: string) => {
  const price =
    content.pricing.type === "per_access" || content.pricing.type === "per_citation"
      ? content.pricing.priceUsdc
      : content.pricing.type === "per_second"
        ? content.pricing.rateUsdc
        : content.pricing.priceUsdc;

  return [
    content.title,
    "",
    content.summary,
    "",
    `Unlock: ${formatUsdc(price)}`,
    unlockUrl,
  ].join("\n");
};

const buildStatsMessage = (stats: CreatorStats) => {
  return [
    "Subgate sales",
    "",
    `Content: ${stats.activeContentCount}/${stats.contentCount} active`,
    `Settled payments: ${stats.settledPaymentCount}`,
    `Total payments: ${stats.paymentCount}`,
    `Revenue: ${formatUsdc(stats.revenueUsdc)}`,
  ].join("\n");
};

const getPublishTargetChat = (
  message: TelegramMessage,
  env: TelegramBotEnv,
): TelegramChatId => {
  return env.DEFAULT_CHANNEL_ID ?? message.chat.id;
};

export const handleTelegramMessage = async (
  message: TelegramMessage,
  services: BotServices,
) => {
  const text = message.text?.trim();

  if (!text) {
    return;
  }

  if (/^\/(?:start|help)(?:@\w+)?/i.test(text)) {
    await services.telegram.sendMessage(message.chat.id, helpText);
    return;
  }

  if (/^\/stats(?:@\w+)?/i.test(text)) {
    const stats = await services.subgate.getCreatorStats(
      services.env.DEFAULT_CREATOR_ID,
    );

    await services.telegram.sendMessage(message.chat.id, buildStatsMessage(stats));
    return;
  }

  if (/^\/publish(?:@\w+)?/i.test(text)) {
    const command = parsePublishCommand(text, services.env.DEFAULT_PRICE_USDC);

    if (!command) {
      await services.telegram.sendMessage(
        message.chat.id,
        "Publish format: /publish Title | 0.003 | Short summary | Full paid body",
      );
      return;
    }

    const slug = `tg-${slugify(command.title)}-${Date.now().toString(36)}`;
    const content = await services.subgate.createContent(
      createContentInputSchema.parse({
        creatorId: services.env.DEFAULT_CREATOR_ID,
        title: command.title,
        slug,
        summary: command.summary,
        body: command.body,
        pricing: {
          type: "per_access",
          priceUsdc: command.priceUsdc,
        },
        isActive: true,
      }),
    );
    const unlockUrl = buildUnlockUrl(services.env.SUBGATE_WEB_URL, content.slug);
    const targetChat = getPublishTargetChat(message, services.env);

    await services.telegram.sendMessage(targetChat, buildTeaser(content, unlockUrl), {
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: `Unlock for ${formatUsdc(command.priceUsdc)}`,
              url: unlockUrl,
            },
          ],
        ],
      },
    });

    await services.telegram.sendMessage(
      message.chat.id,
      [
        "Paid drop published.",
        "",
        content.title,
        unlockUrl,
      ].join("\n"),
    );
    return;
  }

  await services.telegram.sendMessage(message.chat.id, helpText);
};
