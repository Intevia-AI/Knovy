/**
 * Token usage and cost calculation utilities
 * Handles extraction of token data from metadata and cost calculations
 */

// Google Gemini pricing as of 2025 (per 1M tokens)
export const GEMINI_PRICING = {
  "gemini-2.0-flash-exp": {
    input: 0.075,  // $0.075 per 1M input tokens
    output: 0.30,   // $0.30 per 1M output tokens
  },
  "gemini-1.5-flash": {
    input: 0.075,
    output: 0.30,
  },
  "gemini-1.5-pro": {
    input: 1.25,
    output: 5.00,
  },
  // Default pricing if model not found
  default: {
    input: 0.075,
    output: 0.30,
  }
} as const;

export type ModelName = keyof typeof GEMINI_PRICING;

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface TokenMetrics {
  model: string;
  tokens: TokenUsage;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface UserTokenSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  modelBreakdown: Map<string, TokenMetrics>;
  featureBreakdown: Map<string, TokenUsage>;
}

/**
 * Extract token usage from feature metadata
 * Handles multiple metadata structures from different AI features
 */
export function extractTokenUsage(metadata: any): TokenUsage | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  // Check for direct input_tokens/output_tokens fields (used by transcription-enhance)
  if ('input_tokens' in metadata && 'output_tokens' in metadata) {
    const inputTokens = Number(metadata.input_tokens) || 0;
    const outputTokens = Number(metadata.output_tokens) || 0;
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    };
  }

  // Check for nested tokens object
  if (metadata.tokens && typeof metadata.tokens === 'object') {
    const tokens = metadata.tokens;
    return {
      input: Number(tokens.input) || 0,
      output: Number(tokens.output) || 0,
      total: Number(tokens.total) || (Number(tokens.input) || 0) + (Number(tokens.output) || 0),
    };
  }

  // Check for alternative field names
  if (metadata.token_count) {
    return {
      input: Number(metadata.token_count.input) || 0,
      output: Number(metadata.token_count.output) || 0,
      total: Number(metadata.token_count.total) || 0,
    };
  }

  if (metadata.usage) {
    return {
      input: Number(metadata.usage.prompt_tokens) || 0,
      output: Number(metadata.usage.completion_tokens) || 0,
      total: Number(metadata.usage.total_tokens) || 0,
    };
  }

  return null;
}

/**
 * Extract model name from metadata
 */
export function extractModelName(metadata: any): string {
  if (!metadata || typeof metadata !== 'object') {
    return 'unknown';
  }

  return metadata.model || metadata.model_name || metadata.llm_model || 'gemini-2.0-flash-exp';
}

/**
 * Calculate cost for token usage
 */
export function calculateTokenCost(tokens: TokenUsage, model: string): TokenMetrics {
  const pricing = GEMINI_PRICING[model as ModelName] || GEMINI_PRICING.default;

  // Calculate costs (pricing is per 1M tokens)
  const inputCost = (tokens.input / 1_000_000) * pricing.input;
  const outputCost = (tokens.output / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    model,
    tokens,
    inputCost,
    outputCost,
    totalCost,
  };
}

/**
 * Aggregate token usage from multiple feature usage records
 */
export function aggregateTokenUsage(featureUsages: any[]): UserTokenSummary {
  const summary: UserTokenSummary = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    modelBreakdown: new Map(),
    featureBreakdown: new Map(),
  };

  featureUsages.forEach(usage => {
    const tokens = extractTokenUsage(usage.metadata);
    if (!tokens) return;

    const model = extractModelName(usage.metadata);
    const metrics = calculateTokenCost(tokens, model);

    // Update totals
    summary.totalInputTokens += tokens.input;
    summary.totalOutputTokens += tokens.output;
    summary.totalTokens += tokens.total;
    summary.totalCost += metrics.totalCost;

    // Update model breakdown
    const existingModel = summary.modelBreakdown.get(model);
    if (existingModel) {
      existingModel.tokens.input += tokens.input;
      existingModel.tokens.output += tokens.output;
      existingModel.tokens.total += tokens.total;
      existingModel.inputCost += metrics.inputCost;
      existingModel.outputCost += metrics.outputCost;
      existingModel.totalCost += metrics.totalCost;
    } else {
      summary.modelBreakdown.set(model, { ...metrics });
    }

    // Update feature breakdown
    const existingFeature = summary.featureBreakdown.get(usage.feature_name);
    if (existingFeature) {
      existingFeature.input += tokens.input;
      existingFeature.output += tokens.output;
      existingFeature.total += tokens.total;
    } else {
      summary.featureBreakdown.set(usage.feature_name, { ...tokens });
    }
  });

  return summary;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count for display
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

/**
 * Get cost estimation for a specific period
 */
export async function getCostEstimation(
  featureUsages: any[],
  period: 'day' | 'week' | 'month' = 'month'
): Promise<{
  currentCost: number;
  projectedCost: number;
  averageDailyCost: number;
}> {
  const summary = aggregateTokenUsage(featureUsages);

  // Calculate days in the data
  const dates = featureUsages
    .map(u => new Date(u.created_at || u.started_at).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i);

  const daysWithData = dates.length || 1;
  const averageDailyCost = summary.totalCost / daysWithData;

  let projectedCost = summary.totalCost;

  switch (period) {
    case 'day':
      projectedCost = averageDailyCost;
      break;
    case 'week':
      projectedCost = averageDailyCost * 7;
      break;
    case 'month':
      projectedCost = averageDailyCost * 30;
      break;
  }

  return {
    currentCost: summary.totalCost,
    projectedCost,
    averageDailyCost,
  };
}