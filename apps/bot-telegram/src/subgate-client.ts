import type { ContentItem, CreateContentInput } from "@subgate/types";

export type CreatorStats = {
  creatorId: string;
  contentCount: number;
  activeContentCount: number;
  paymentCount: number;
  settledPaymentCount: number;
  revenueUsdc: number;
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
