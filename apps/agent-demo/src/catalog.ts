import {
  contentCatalogItemSchema,
  contentUnlockSchema,
  pricingQuoteSchema,
  type ContentCatalogItem,
  type ContentUnlock,
  type PricingQuote,
} from "@subgate/types";

const joinUrl = (baseUrl: string, path: string): string => {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
};

const parseJsonResponse = async <T>(
  response: Response,
  parser: { parse: (value: unknown) => T },
): Promise<T> => {
  const payload = await response.json();

  return parser.parse(payload);
};

export const fetchCatalog = async (
  apiUrl: string,
): Promise<ContentCatalogItem[]> => {
  const response = await fetch(joinUrl(apiUrl, "/catalog"));

  if (!response.ok) {
    throw new Error(`Catalog request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();

  return contentCatalogItemSchema.array().parse(payload);
};

export const fetchQuote = async (
  apiUrl: string,
  slug: string,
): Promise<PricingQuote> => {
  const response = await fetch(joinUrl(apiUrl, `/content/${slug}/quote`));

  if (!response.ok) {
    throw new Error(`Quote request failed for ${slug} with HTTP ${response.status}.`);
  }

  return parseJsonResponse(response, pricingQuoteSchema);
};

export const parseUnlockResponse = (value: unknown): ContentUnlock => {
  return contentUnlockSchema.parse(value);
};

export const contentUrl = (apiUrl: string, slug: string): string => {
  return joinUrl(apiUrl, `/content/${slug}`);
};
