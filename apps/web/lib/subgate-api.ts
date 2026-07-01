import type {
  ContentCatalogItem,
  ContentItem,
  ContentUnlock,
  Creator,
  CreatorContentPerformance,
  CreatorPayment,
  CreatorStats,
  CreateContentInput,
  PaymentPipelineDiagnostics,
  PricingQuote,
  X402PaymentRequired,
} from "@subgate/types";

const DEFAULT_API_URL = "http://localhost:3001";

export type CatalogContentState = {
  item: ContentCatalogItem;
  quote: PricingQuote | null;
  paymentRequired: X402PaymentRequired | null;
  error: string | null;
};

export type HomeApiState = {
  apiUrl: string;
  catalog: CatalogContentState[];
  isOnline: boolean;
  error: string | null;
};

export type DashboardState = {
  apiUrl: string;
  creators: Creator[];
  catalog: ContentCatalogItem[];
  creatorStats: CreatorStats | null;
  creatorPayments: CreatorPayment[];
  contentPerformance: CreatorContentPerformance[];
  integrationSources: IntegrationSourceRecord[];
  externalContentMappings: ExternalContentMappingRecord[];
  externalAccessRules: ExternalAccessRuleRecord[];
  pipelineDiagnostics: PaymentPipelineDiagnostics | null;
  isConfigured: boolean;
  error: string | null;
};

export type IntegrationSourceRecord = {
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

export type ExternalContentMappingRecord = {
  id: string;
  integrationSourceId: string;
  contentId: string;
  platform: string;
  externalId: string;
  externalType: string;
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ExternalAccessRuleRecord = {
  id: string;
  integrationSourceId: string;
  contentMappingId: string | null;
  contentId: string | null;
  platform: string;
  externalId: string;
  externalType: string;
  name: string;
  ruleType: string;
  requiredGroups: string[];
  pricing: PricingQuote["pricing"] | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContentPageState = CatalogContentState & {
  apiUrl: string;
};

export const getApiUrl = () => {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
};

export const getInternalServiceSecret = () => {
  return process.env.INTERNAL_SERVICE_SECRET ?? "";
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    next: {
      revalidate: 15,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
};

const fetchInternalJson = async <T>(url: string): Promise<T> => {
  const secret = getInternalServiceSecret();

  if (!secret) {
    throw new Error("INTERNAL_SERVICE_SECRET is not configured for apps/web.");
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "x-subgate-internal-secret": secret,
    },
  });

  if (!response.ok) {
    throw new Error(`Internal request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
};

const decodeBase64Json = <T>(value: string): T => {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
};

const fetchPaymentRequired = async (
  apiUrl: string,
  slug: string,
): Promise<X402PaymentRequired | null> => {
  const response = await fetch(`${apiUrl}/content/${slug}`, {
    next: {
      revalidate: 15,
    },
  });

  if (response.status !== 402) {
    return null;
  }

  const header = response.headers.get("PAYMENT-REQUIRED");

  return header ? decodeBase64Json<X402PaymentRequired>(header) : null;
};

export const fetchContentPageState = async (
  slug: string,
): Promise<ContentPageState | null> => {
  const apiUrl = getApiUrl();
  const catalog = await fetchJson<ContentCatalogItem[]>(`${apiUrl}/catalog`);
  const item = catalog.find((catalogItem) => catalogItem.slug === slug);

  if (!item) {
    return null;
  }

  try {
    const [quote, paymentRequired] = await Promise.all([
      fetchJson<PricingQuote>(`${apiUrl}/content/${item.slug}/quote`),
      fetchPaymentRequired(apiUrl, item.slug),
    ]);

    return {
      apiUrl,
      item,
      quote,
      paymentRequired,
      error: null,
    };
  } catch (error) {
    return {
      apiUrl,
      item,
      quote: null,
      paymentRequired: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load content payment state.",
    };
  }
};

export type UnlockProxyResponse =
  | {
      status: "payment_required";
      paymentRequired: X402PaymentRequired;
      paymentRequiredHeader: string;
    }
  | {
      status: "unlocked";
      content: ContentUnlock;
      paymentResponseHeader: string | null;
    }
  | {
      status: "error";
      message: string;
    };

export const fetchHomeApiState = async (): Promise<HomeApiState> => {
  const apiUrl = getApiUrl();

  try {
    const catalog = await fetchJson<ContentCatalogItem[]>(`${apiUrl}/catalog`);
    const catalogState = await Promise.all(
      catalog.map(async (item): Promise<CatalogContentState> => {
        try {
          const [quote, paymentRequired] = await Promise.all([
            fetchJson<PricingQuote>(`${apiUrl}/content/${item.slug}/quote`),
            fetchPaymentRequired(apiUrl, item.slug),
          ]);

          return {
            item,
            quote,
            paymentRequired,
            error: null,
          };
        } catch (error) {
          return {
            item,
            quote: null,
            paymentRequired: null,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load content payment state.",
          };
        }
      }),
    );

    return {
      apiUrl,
      catalog: catalogState,
      isOnline: true,
      error: null,
    };
  } catch (error) {
    return {
      apiUrl,
      catalog: [],
      isOnline: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to reach the Subgate API.",
    };
  }
};

export const fetchDashboardState = async (): Promise<DashboardState> => {
  const apiUrl = getApiUrl();
  const isConfigured = getInternalServiceSecret().length > 0;

  try {
    const [
      creators,
      catalog,
      integrationSources,
      externalContentMappings,
      externalAccessRules,
      pipelineDiagnostics,
    ] = await Promise.all([
      fetchInternalJson<Creator[]>(`${apiUrl}/creators`),
      fetchJson<ContentCatalogItem[]>(`${apiUrl}/catalog`),
      fetchInternalJson<IntegrationSourceRecord[]>(`${apiUrl}/integrations/sources`),
      fetchInternalJson<ExternalContentMappingRecord[]>(
        `${apiUrl}/integrations/mappings`,
      ),
      fetchInternalJson<ExternalAccessRuleRecord[]>(`${apiUrl}/integrations/rules`),
      fetchInternalJson<PaymentPipelineDiagnostics>(
        `${apiUrl}/diagnostics/payment-pipeline`,
      ),
    ]);
    const primaryCreator = creators[0] ?? null;
    const [creatorStatsResult, creatorPaymentsResult, contentPerformanceResult] =
      primaryCreator
        ? await Promise.all([
            fetchInternalJson<CreatorStats>(
              `${apiUrl}/creators/${primaryCreator.id}/stats`,
            ),
            fetchInternalJson<CreatorPayment[]>(
              `${apiUrl}/creators/${primaryCreator.id}/payments?limit=25`,
            ),
            fetchInternalJson<CreatorContentPerformance[]>(
              `${apiUrl}/creators/${primaryCreator.id}/content-performance`,
            ),
          ])
        : [null, [] as CreatorPayment[], [] as CreatorContentPerformance[]];

    return {
      apiUrl,
      creators,
      catalog,
      creatorStats: creatorStatsResult,
      creatorPayments: creatorPaymentsResult,
      contentPerformance: contentPerformanceResult,
      integrationSources,
      externalContentMappings,
      externalAccessRules,
      pipelineDiagnostics,
      isConfigured,
      error: null,
    };
  } catch (error) {
    return {
      apiUrl,
      creators: [],
      catalog: [],
      creatorStats: null,
      creatorPayments: [],
      contentPerformance: [],
      integrationSources: [],
      externalContentMappings: [],
      externalAccessRules: [],
      pipelineDiagnostics: null,
      isConfigured,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load dashboard data.",
    };
  }
};

export const createDashboardContent = async (
  input: CreateContentInput,
): Promise<ContentItem> => {
  const secret = getInternalServiceSecret();

  if (!secret) {
    throw new Error("INTERNAL_SERVICE_SECRET is not configured for apps/web.");
  }

  const response = await fetch(`${getApiUrl()}/content`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-subgate-internal-secret": secret,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Content creation failed with status ${response.status}.`;

    throw new Error(message);
  }

  return response.json() as Promise<ContentItem>;
};
