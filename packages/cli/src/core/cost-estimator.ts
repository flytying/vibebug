import {
  AI_PRICING,
  DEFAULT_AI_MODEL,
  DEFAULT_ESTIMATED_OUTPUT_TOKENS,
  CHARS_PER_TOKEN,
} from '../utils/constants.js';

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export function estimateCost(rawLogLength: number, model?: string): CostEstimate {
  const modelKey = model ?? DEFAULT_AI_MODEL;
  const pricing = AI_PRICING[modelKey] ?? AI_PRICING[DEFAULT_AI_MODEL]!;

  const inputTokens = Math.ceil(rawLogLength / CHARS_PER_TOKEN);
  const outputTokens = DEFAULT_ESTIMATED_OUTPUT_TOKENS;

  // Pricing is per million tokens
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

  return { inputTokens, outputTokens, cost };
}
