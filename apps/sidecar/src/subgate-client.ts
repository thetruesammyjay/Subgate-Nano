import type { ContentItem, CreateContentInput } from "@subgate/types";
import type {
  NormalizedExternalAccessRule,
  NormalizedExternalContent,
} from "@subgate/integrations";

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

  async syncIntegrationMapping(input: {
    source: {
      creatorId: string;
      platform: string;
      externalSourceId: string;
      name: string;
      baseUrl?: string | null;
      metadata?: Record<string, unknown>;
    };
    content: ContentItem;
    externalContent: NormalizedExternalContent;
    accessRules: NormalizedExternalAccessRule[];
  }) {
    const response = await this.fetchImpl(
      `${this.apiUrl}/integrations/mappings/sync`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-subgate-internal-secret": this.internalServiceSecret,
        },
        body: JSON.stringify({
          source: input.source,
          contentMapping: {
            contentId: input.content.id,
            platform: input.externalContent.platform,
            externalId: input.externalContent.externalId,
            externalType: "topic",
            sourceUrl: input.externalContent.sourceUrl,
            metadata: input.externalContent.metadata,
          },
          accessRules: input.accessRules,
        }),
      },
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : `Subgate integration mapping sync failed with status ${response.status}.`;

      throw new Error(message);
    }

    return payload;
  }
}
