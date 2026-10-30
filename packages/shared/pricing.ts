/**
 * Versioned OpenAI Pricing Catalog (rates per 1M tokens in USD).
 * Standard rates updated as of 2026.
 */

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
}

export const PRICING_CATALOG_VERSION = '2026-10-v1';

export const MODEL_PRICING_CATALOG: Record<string, ModelPricing> = {
  'gpt-4o': {
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    cachedInputPerMillion: 1.25,
  },
  'gpt-4o-2024-08-06': {
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    cachedInputPerMillion: 1.25,
  },
  'gpt-4o-mini': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cachedInputPerMillion: 0.075,
  },
  'gpt-4o-mini-2024-07-18': {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cachedInputPerMillion: 0.075,
  },
  'o1': {
    inputPerMillion: 15.0,
    outputPerMillion: 60.0,
    cachedInputPerMillion: 7.5,
  },
  'o1-mini': {
    inputPerMillion: 3.0,
    outputPerMillion: 12.0,
    cachedInputPerMillion: 1.5,
  },
  'o3-mini': {
    inputPerMillion: 1.1,
    outputPerMillion: 4.4,
    cachedInputPerMillion: 0.55,
  },
};

/**
 * Calculates total cost for token usage.
 * Returns null if the model has no known pricing in the catalog.
 */
export function calculateTokenCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0
): number | null {
  const pricing = MODEL_PRICING_CATALOG[modelId];
  if (!pricing) {
    return null; // Unknown pricing, do NOT return 0 (Section 9.5)
  }

  const regularInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const cachedCost =
    pricing.cachedInputPerMillion && cachedInputTokens > 0
      ? (cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion
      : 0;

  const regularInputCost = (regularInputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  const totalCost = regularInputCost + cachedCost + outputCost;
  return Math.round(totalCost * 1_000_000) / 1_000_000;
}
