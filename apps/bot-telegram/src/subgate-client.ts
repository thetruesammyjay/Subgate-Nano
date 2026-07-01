import type { ContentItem, CreateContentInput } from "@subgate/types";

export type CreatorStats = {
  creatorId: string;
  contentCount: number;
  activeContentCount: number;
  paymentCount: number;
  settledPaymentCount: number;
  revenueUsdc: number;
};

export type IntegrationSource = {
  id: string;
  creatorId: string;
  platform: string;
  externalSourceId: string;
  name: string;
  baseUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TelegramChannelBindingInput = {
  creatorId: string;
  chatId: string;
  name: string;
  chatType: string;
  username?: string;
  boundByTelegramUserId?: number;
};

export type SubgateClientOptions = {
  apiUrl: string;
  internalServiceSecret: string;
  fetchImpl?: typeof fetch;
};

export class SubgateClient {
  private readonly apiUrl: string;
  private readonly internalServiceSecret: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SubgateClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, "");
    this.internalServiceSecret = options.internalServiceSecret;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createContent(input: CreateContentInput): Promise<ContentItem> {
    const response = await this.fetchImpl(`${this.apiUrl}/content`, {
      method: "POST",
      headers: this.internalJsonHeaders(),
      body: JSON.stringify(input),
    });

    return this.parseResponse<ContentItem>(response, "Subgate content publish failed");
  }

  async getCreatorStats(creatorId: string): Promise<CreatorStats> {
    const response = await this.fetchImpl(
      `${this.apiUrl}/creators/${encodeURIComponent(creatorId)}/stats`,
      {
        headers: {
          "x-subgate-internal-secret": this.internalServiceSecret,
        },
      },
    );

    return this.parseResponse<CreatorStats>(response, "Subgate stats request failed");
  }

  async listTelegramChannels(creatorId: string): Promise<IntegrationSource[]> {
    const query = new URLSearchParams({
      creatorId,
      platform: "telegram",
    });
    const response = await this.fetchImpl(
      `${this.apiUrl}/integrations/sources?${query.toString()}`,
      {
        headers: {
          "x-subgate-internal-secret": this.internalServiceSecret,
        },
      },
    );

    return this.parseResponse<IntegrationSource[]>(
      response,
      "Subgate integration source request failed",
    );
  }

  async bindTelegramChannel(
    input: TelegramChannelBindingInput,
  ): Promise<IntegrationSource> {
    const response = await this.fetchImpl(`${this.apiUrl}/integrations/sources`, {
      method: "POST",
      headers: this.internalJsonHeaders(),
      body: JSON.stringify({
        creatorId: input.creatorId,
        platform: "telegram",
        externalSourceId: input.chatId,
        name: input.name,
        baseUrl: input.username ? `https://t.me/${input.username}` : null,
        metadata: {
          chatType: input.chatType,
          username: input.username,
          boundByTelegramUserId: input.boundByTelegramUserId,
          boundAt: new Date().toISOString(),
        },
      }),
    });

    return this.parseResponse<IntegrationSource>(
      response,
      "Subgate integration source bind failed",
    );
  }

  async syncTelegramPublishMapping(input: {
    channel: IntegrationSource;
    content: ContentItem;
    messageId: number;
    messageUrl?: string;
  }) {
    const response = await this.fetchImpl(
      `${this.apiUrl}/integrations/mappings/sync`,
      {
        method: "POST",
        headers: this.internalJsonHeaders(),
        body: JSON.stringify({
          source: {
            creatorId: input.content.creatorId,
            platform: "telegram",
            externalSourceId: input.channel.externalSourceId,
            name: input.channel.name,
            baseUrl: input.channel.baseUrl,
            metadata: input.channel.metadata,
          },
          contentMapping: {
            contentId: input.content.id,
            platform: "telegram",
            externalId: String(input.messageId),
            externalType: "telegram_message",
            sourceUrl: input.messageUrl ?? null,
            metadata: {
              channelId: input.channel.externalSourceId,
              channelName: input.channel.name,
            },
          },
          accessRules: [
            {
              platform: "telegram",
              externalId: input.channel.externalSourceId,
              externalType: "telegram_channel",
              name: input.channel.name,
              ruleType: "paid_unlock_link",
              pricing: input.content.pricing,
              requiredGroups: [],
              metadata: {
                messageId: input.messageId,
                messageUrl: input.messageUrl,
              },
              isActive: input.content.isActive,
            },
          ],
        }),
      },
    );

    return this.parseResponse<unknown>(
      response,
      "Subgate integration mapping sync failed",
    );
  }

  private internalJsonHeaders() {
    return {
      "content-type": "application/json",
      "x-subgate-internal-secret": this.internalServiceSecret,
    };
  }

  private async parseResponse<T>(
    response: Response,
    fallbackMessage: string,
  ): Promise<T> {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : `${fallbackMessage} with status ${response.status}.`;

      throw new Error(message);
    }

    return payload as T;
  }
}
