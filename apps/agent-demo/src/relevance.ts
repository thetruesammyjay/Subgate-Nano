import type { ContentCatalogItem } from "@subgate/types";

const tokenize = (value: string): Set<string> => {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
};

export const scoreRelevance = (
  query: string,
  item: ContentCatalogItem,
): number => {
  const queryTokens = tokenize(query);
  const itemTokens = tokenize(`${item.title} ${item.summary} ${item.slug}`);

  if (queryTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of queryTokens) {
    if (itemTokens.has(token)) {
      matches += 1;
    }
  }

  const lexicalScore = matches / queryTokens.size;
  const activeBoost = item.isActive ? 0.1 : 0;

  return Math.min(1, Number((lexicalScore + activeBoost).toFixed(4)));
};
