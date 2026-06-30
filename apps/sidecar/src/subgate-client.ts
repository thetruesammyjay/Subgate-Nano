import type { ContentItem, CreateContentInput } from "@subgate/types";

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

  async syncContent(input: CreateContentInput): Promise<ContentItem> {
    const response = await this.fetchImpl(`${this.apiUrl}/content/sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-subgate-internal-secret": this.internalServiceSecret,
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : `Subgate content sync failed with status ${response.status}.`;

      throw new Error(message);
    }

    return payload as ContentItem;
  }
}
