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
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export type SendMessageOptions = {
  disableWebPagePreview?: boolean;
  replyMarkup?: Record<string, unknown>;
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
  ) {
    return this.post("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: options.disableWebPagePreview ?? true,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    });
  }

  private async post(method: string, body: Record<string, unknown>) {
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

    return payload;
  }
}
