import { describe, it, expect } from 'vitest';
import { calculateTokenCost, MODEL_PRICING_CATALOG } from '../../packages/shared/pricing';

describe('Token Usage & Cost Calculation', () => {
  it('correctly calculates cost for known models', () => {
    // gpt-4o: 2.5 input, 10 output per 1M
    const cost = calculateTokenCost('gpt-4o', 1000, 2000);
    // (1000 / 1e6 * 2.5) + (2000 / 1e6 * 10) = 0.0025 + 0.02 = 0.0225
    expect(cost).toBe(0.0225);
  });

  it('correctly accounts for cached input tokens', () => {
    // gpt-4o: 2.5 standard input, 1.25 cached input
    const cost = calculateTokenCost('gpt-4o', 1000, 1000, 500);
    // regular 500 * 2.5 / 1e6 = 0.00125
    // cached 500 * 1.25 / 1e6 = 0.000625
    // output 1000 * 10 / 1e6 = 0.010
    // total = 0.011875
    expect(cost).toBe(0.011875);
  });

  it('returns null (unknown cost) for unrecognized model IDs without falling back to zero', () => {
    const cost = calculateTokenCost('unknown-future-model-x', 1000, 1000);
    expect(cost).toBeNull();
  });
});
