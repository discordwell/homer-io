import { describe, it, expect } from 'vitest';
import { riskSummary } from './RiskBadge.js';

describe('riskSummary', () => {
  it('returns null when no risky stops', () => {
    expect(riskSummary([{ score: 10 }, { score: 25 }, { score: 30 }])).toBeNull();
  });

  it('reports high-risk stops', () => {
    const result = riskSummary([{ score: 75 }, { score: 20 }, { score: 85 }]);
    expect(result).toBe('2 high-risk stops');
  });

  it('reports medium-risk stops', () => {
    const result = riskSummary([{ score: 45 }, { score: 10 }]);
    expect(result).toBe('1 medium-risk');
  });

  it('reports both high and medium', () => {
    const result = riskSummary([{ score: 80 }, { score: 50 }, { score: 15 }]);
    expect(result).toBe('1 high-risk stop, 1 medium-risk');
  });

  it('returns null for empty array', () => {
    expect(riskSummary([])).toBeNull();
  });
});
