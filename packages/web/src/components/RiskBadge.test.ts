import { describe, it, expect } from 'vitest';
import { riskSummary, getRiskLevel } from './RiskBadge.js';

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

describe('getRiskLevel', () => {
  it('returns Low Risk for score 0', () => {
    const result = getRiskLevel(0);
    expect(result).toEqual({ label: 'Low Risk', color: '#34D399' });
  });

  it('returns Low Risk for score 19', () => {
    const result = getRiskLevel(19);
    expect(result).toEqual({ label: 'Low Risk', color: '#34D399' });
  });

  it('returns null (normal) for score 20', () => {
    expect(getRiskLevel(20)).toBeNull();
  });

  it('returns null (normal) for score 39', () => {
    expect(getRiskLevel(39)).toBeNull();
  });

  it('returns Medium Risk for score 40', () => {
    const result = getRiskLevel(40);
    expect(result).toEqual({ label: 'Medium Risk', color: '#FBBF24' });
  });

  it('returns Medium Risk for score 59', () => {
    const result = getRiskLevel(59);
    expect(result).toEqual({ label: 'Medium Risk', color: '#FBBF24' });
  });

  it('returns High Risk for score 60', () => {
    const result = getRiskLevel(60);
    expect(result).toEqual({ label: 'High Risk', color: '#FB923C' });
  });

  it('returns High Risk for score 79', () => {
    const result = getRiskLevel(79);
    expect(result).toEqual({ label: 'High Risk', color: '#FB923C' });
  });

  it('returns Critical for score 80', () => {
    const result = getRiskLevel(80);
    expect(result).toEqual({ label: 'Critical', color: '#F87171' });
  });

  it('returns Critical for score 100', () => {
    const result = getRiskLevel(100);
    expect(result).toEqual({ label: 'Critical', color: '#F87171' });
  });
});
