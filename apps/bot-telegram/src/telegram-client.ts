export type TelegramChatId = number | string;

export type TelegramMessage = {
  message_id: number;
  chat: {
    id: TelegramChatId;
    type: string;
    title?: string;
    username?: string;
  };
  from?: {
    id: number;
    first_name?: string;
    username?: string;
  };
  text?: string;
  reply_to_message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

export type SendMessageOptions = {
  disableWebPagePreview?: boolean;
  replyMarkup?: Record<string, unknown>;
};

export type TelegramSendMessageResult = {
  ok: boolean;
  result?: TelegramMessage;
};

export type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

export type TelegramClientOptions = {
  botToken: string;
  fetchImpl?: typeof fetch;
};

export class TelegramClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TelegramClientOptions) {
    this.baseUrl = `https://api.telegram.org/bot${options.botToken}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendMessage(
    chatId: TelegramChatId,
    text: string,
    options: SendMessageOptions = {},
  ): Promise<TelegramSendMessageResult> {
    return this.post<TelegramSendMessageResult>("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: options.disableWebPagePreview ?? true,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    });
  }

  async setWebhook(options: {
    url: string;
    secretToken?: string;
    allowedUpdates?: string[];
  }) {
    return this.post<{ ok: boolean; result: boolean; description?: string }>(
      "setWebhook",
      {
        url: options.url,
        ...(options.secretToken
          ? { secret_token: options.secretToken }
          : {}),
        allowed_updates: options.allowedUpdates ?? ["message", "channel_post"],
      },
    );
  }

  async deleteWebhook() {
    return this.post<{ ok: boolean; result: boolean; description?: string }>(
      "deleteWebhook",
      {},
    );
  }

  async getWebhookInfo() {
    return this.post<{ ok: boolean; result: TelegramWebhookInfo }>(
      "getWebhookInfo",
      {},
    );
  }

  private async post<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const description =
        typeof payload === "object" &&
        payload !== null &&
        "description" in payload &&
        typeof payload.description === "string"
          ? payload.description
          : `Telegram ${method} failed with HTTP ${response.status}.`;

      throw new Error(description);
    }

    return payload as T;
  }
}
