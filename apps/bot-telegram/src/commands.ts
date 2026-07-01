import { createContentInputSchema, type ContentItem } from "@subgate/types";
import type { TelegramBotEnv } from "./env.js";
import type {
  CreatorStats,
  IntegrationSource,
  SubgateClient,
} from "./subgate-client.js";
import type {
  TelegramChatId,
  TelegramClient,
  TelegramMessage,
  TelegramSendMessageResult,
} from "./telegram-client.js";

export type BotServices = {
  env: TelegramBotEnv;
  subgate: Pick<
    SubgateClient,
    | "bindTelegramChannel"
    | "createContent"
    | "getCreatorStats"
    | "listTelegramChannels"
    | "syncTelegramPublishMapping"
  >;
  telegram: Pick<TelegramClient, "sendMessage">;
};

type PublishCommand = {
  title: string;
  priceUsdc: number;
  summary: string;
  body: string;
  targetToken?: string;
};

const helpText = [
  "Subgate Nano creator bot",
  "",
  "Bind this chat or channel:",
  "/bind",
  "",
  "Publish a paid drop:",
  "/publish Title | 0.003 | Short summary | Full paid body",
  "/publish Title | Short summary | Full paid body",
  "",
  "Reply to a draft message:",
  "/publish Title | 0.003 | Short summary",
  "",
  "Target a channel:",
  "/publish to @channel Title | 0.003 | Short summary | Full paid body",
  "",
  "View sales:",
  "/stats",
  "",
  "View bound channel:",
  "/channel",
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

const readReplyText = (message: TelegramMessage) => {
  return message.reply_to_message?.text?.trim() ?? "";
};

const extractTargetToken = (value: string) => {
  const match = /^to\s+(@[\w_]{3,}|-?\d+)\s+/i.exec(value);

  if (!match) {
    return {
      targetToken: undefined,
      body: value,
    };
  }

  return {
    targetToken: match[1],
    body: value.slice(match[0].length).trim(),
  };
};

const parsePublishCommand = (
  text: string,
  defaultPriceUsdc: number,
  replyText = "",
): PublishCommand | null => {
  const rawBody = trimCommand(text, "publish");

  if (!rawBody) {
    return null;
  }

  const { targetToken, body } = extractTargetToken(rawBody);
  const parts = (
    body.includes("|")
      ? body.split("|").map((part) => part.trim())
      : body.split(/\r?\n/).map((part) => part.trim())
  ).filter((part) => part.length > 0);

  if (parts.length < 2) {
    return null;
  }

  const [title, second, third, ...bodyParts] = parts;
  const explicitPrice = second ? Number(second) : Number.NaN;
  const hasExplicitPrice = Number.isFinite(explicitPrice);
  const priceUsdc = hasExplicitPrice ? explicitPrice : defaultPriceUsdc;
  const summary = hasExplicitPrice ? third : second;
  const paidBody = (
    hasExplicitPrice ? bodyParts.join("\n") : [third, ...bodyParts].join("\n")
  ).trim() || replyText;

  if (!title || !summary || !paidBody || !Number.isFinite(priceUsdc)) {
    return null;
  }

  return {
    title,
    priceUsdc,
    summary,
    body: paidBody,
    ...(targetToken ? { targetToken } : {}),
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

const chatIdToString = (chatId: TelegramChatId) => {
  return String(chatId);
};

const getChatDisplayName = (message: TelegramMessage) => {
  return (
    message.chat.title ??
    (message.chat.username ? `@${message.chat.username}` : undefined) ??
    `Telegram chat ${message.chat.id}`
  );
};

const sourceUsername = (source: IntegrationSource) => {
  const username = source.metadata.username;

  return typeof username === "string" && username ? username : null;
};

const buildFallbackChannel = (
  message: TelegramMessage,
  env: TelegramBotEnv,
): IntegrationSource => {
  const externalSourceId = env.DEFAULT_CHANNEL_ID ?? chatIdToString(message.chat.id);

  return {
    id: "telegram-fallback-source",
    creatorId: env.DEFAULT_CREATOR_ID,
    platform: "telegram",
    externalSourceId,
    name: env.DEFAULT_CHANNEL_ID
      ? `Telegram ${env.DEFAULT_CHANNEL_ID}`
      : getChatDisplayName(message),
    baseUrl:
      env.DEFAULT_CHANNEL_ID?.startsWith("@")
        ? `https://t.me/${env.DEFAULT_CHANNEL_ID.slice(1)}`
        : null,
    metadata: {
      chatType: message.chat.type,
      username: env.DEFAULT_CHANNEL_ID?.startsWith("@")
        ? env.DEFAULT_CHANNEL_ID.slice(1)
        : message.chat.username,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const sortChannels = (channels: IntegrationSource[]) => {
  return [...channels].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
};

const resolvePublishChannel = async (
  message: TelegramMessage,
  services: BotServices,
  targetToken?: string,
) => {
  const channels = sortChannels(
    await services.subgate.listTelegramChannels(
      services.env.DEFAULT_CREATOR_ID,
    ),
  );

  if (targetToken) {
    const normalizedTarget = targetToken.replace(/^@/, "").toLowerCase();
    const matchedChannel = channels.find((channel) => {
      const username = sourceUsername(channel);

      return (
        channel.externalSourceId === targetToken ||
        username?.toLowerCase() === normalizedTarget ||
        channel.name.toLowerCase() === normalizedTarget
      );
    });

    if (matchedChannel) {
      return matchedChannel;
    }

    return {
      ...buildFallbackChannel(message, services.env),
      externalSourceId: targetToken,
      name: `Telegram ${targetToken}`,
      baseUrl: targetToken.startsWith("@")
        ? `https://t.me/${targetToken.slice(1)}`
        : null,
      metadata: {
        chatType: "channel",
        username: targetToken.startsWith("@") ? targetToken.slice(1) : undefined,
      },
    };
  }

  return channels[0] ?? buildFallbackChannel(message, services.env);
};

const buildTelegramMessageUrl = (
  channel: IntegrationSource,
  messageId: number | undefined,
) => {
  if (!messageId) {
    return undefined;
  }

  const username = sourceUsername(channel);

  if (username) {
    return `https://t.me/${username}/${messageId}`;
  }

  if (channel.externalSourceId.startsWith("-100")) {
    return `https://t.me/c/${channel.externalSourceId.slice(4)}/${messageId}`;
  }

  return undefined;
};

const channelSummary = (channel: IntegrationSource) => {
  const username = sourceUsername(channel);
  const handle = username ? `@${username}` : channel.externalSourceId;

  return `${channel.name} (${handle})`;
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

  if (/^\/bind(?:@\w+)?/i.test(text)) {
    const channel = await services.subgate.bindTelegramChannel({
      creatorId: services.env.DEFAULT_CREATOR_ID,
      chatId: chatIdToString(message.chat.id),
      name: getChatDisplayName(message),
      chatType: message.chat.type,
      ...(message.chat.username ? { username: message.chat.username } : {}),
      ...(message.from?.id
        ? { boundByTelegramUserId: message.from.id }
        : {}),
    });

    await services.telegram.sendMessage(
      message.chat.id,
      [
        "Telegram channel bound.",
        "",
        channelSummary(channel),
        "",
        "New /publish drops will post here unless you target another channel.",
      ].join("\n"),
    );
    return;
  }

  if (/^\/channel(?:@\w+)?/i.test(text)) {
    const channels = sortChannels(
      await services.subgate.listTelegramChannels(
        services.env.DEFAULT_CREATOR_ID,
      ),
    );
    const activeChannel = channels[0] ?? buildFallbackChannel(message, services.env);

    await services.telegram.sendMessage(
      message.chat.id,
      [
        "Active publish channel",
        "",
        channelSummary(activeChannel),
        channels.length > 1
          ? `Other bound channels: ${channels.slice(1).map(channelSummary).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
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
    const command = parsePublishCommand(
      text,
      services.env.DEFAULT_PRICE_USDC,
      readReplyText(message),
    );

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
    const channel = await resolvePublishChannel(
      message,
      services,
      command.targetToken,
    );

    let publishedMessage: TelegramSendMessageResult;

    try {
      publishedMessage = await services.telegram.sendMessage(
        channel.externalSourceId,
        buildTeaser(content, unlockUrl),
        {
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
        },
      );
    } catch (error) {
      await services.telegram.sendMessage(
        message.chat.id,
        error instanceof Error
          ? `Publish created the paid content, but Telegram posting failed: ${error.message}`
          : "Publish created the paid content, but Telegram posting failed.",
      );
      return;
    }

    const messageId = publishedMessage.result?.message_id;

    if (messageId) {
      const messageUrl = buildTelegramMessageUrl(channel, messageId);

      await services.subgate.syncTelegramPublishMapping({
        channel,
        content,
        messageId,
        ...(messageUrl ? { messageUrl } : {}),
      });
    }

    await services.telegram.sendMessage(
      message.chat.id,
      [
        "Paid drop published.",
        "",
        content.title,
        `Channel: ${channelSummary(channel)}`,
        messageId ? `Telegram post: ${messageId}` : "",
        unlockUrl,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return;
  }

  await services.telegram.sendMessage(message.chat.id, helpText);
};
