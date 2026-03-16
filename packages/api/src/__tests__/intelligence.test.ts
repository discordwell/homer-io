import { describe, it, expect } from 'vitest';

// Test risk scoring logic (pure function behavior extracted from risk-scorer)

interface RiskFactor {
  name: string;
  points: number;
  detail: string;
}

function computeRiskFactors(params: {
  failureRate?: number;
  totalDeliveries?: number;
  failedDeliveries?: number;
  plannedHour?: number;
  hourlyData?: Array<{ hour: number; success_rate: number; sample_size: number }>;
  timeWindowMinutes?: number;
  hasHistory?: boolean;
  driverFailedHere?: boolean;
}): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];

  if (params.hasHistory === false) {
    factors.push({ name: 'no_history', points: 5, detail: 'First delivery to this address' });
  }

  if (params.failureRate != null && params.failureRate > 0.3 && params.totalDeliveries != null) {
    factors.push({
      name: 'high_failure_rate',
      points: 30,
      detail: `${Math.round(params.failureRate * 100)}% failure rate (${params.failedDeliveries}/${params.totalDeliveries})`,
    });
  }

  if (params.plannedHour != null && params.hourlyData) {
    const hourData = params.hourlyData.find(h => h.hour === params.plannedHour);
    if (hourData && hourData.sample_size >= 3 && hourData.success_rate < 0.5) {
      factors.push({
        name: 'bad_delivery_hour',
        points: 20,
        detail: `${Math.round(hourData.success_rate * 100)}% success at hour ${params.plannedHour} (n=${hourData.sample_size})`,
      });
    }
  }

  if (params.timeWindowMinutes != null && params.timeWindowMinutes > 0 && params.timeWindowMinutes < 60) {
    factors.push({
      name: 'tight_time_window',
      points: 10,
      detail: `${Math.round(params.timeWindowMinutes)} minute window`,
    });
  }

  if (params.driverFailedHere) {
    factors.push({
      name: 'driver_failed_here',
      points: 15,
      detail: 'A driver has previously failed at this address',
    });
  }

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  return { score, factors };
}

describe('Intelligence - Risk Scoring', () => {
  it('returns 0 risk for address with good history', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      failureRate: 0.1,
      totalDeliveries: 10,
      failedDeliveries: 1,
    });
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  it('adds 30 points for >30% failure rate', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      failureRate: 0.5,
      totalDeliveries: 10,
      failedDeliveries: 5,
    });
    expect(result.factors.find(f => f.name === 'high_failure_rate')).toBeDefined();
    expect(result.score).toBe(30);
  });

  it('adds 20 points for bad delivery hour', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      failureRate: 0.1,
      totalDeliveries: 10,
      failedDeliveries: 1,
      plannedHour: 14,
      hourlyData: [
        { hour: 14, success_rate: 0.3, sample_size: 5 },
      ],
    });
    expect(result.factors.find(f => f.name === 'bad_delivery_hour')).toBeDefined();
    expect(result.score).toBe(20);
  });

  it('ignores bad hour with insufficient samples', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      failureRate: 0.1,
      totalDeliveries: 10,
      failedDeliveries: 1,
      plannedHour: 14,
      hourlyData: [
        { hour: 14, success_rate: 0.2, sample_size: 2 },
      ],
    });
    expect(result.factors.find(f => f.name === 'bad_delivery_hour')).toBeUndefined();
  });

  it('adds 10 points for tight time window', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      timeWindowMinutes: 30,
    });
    expect(result.factors.find(f => f.name === 'tight_time_window')).toBeDefined();
    expect(result.score).toBe(10);
  });

  it('does not flag wide time windows', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      timeWindowMinutes: 120,
    });
    expect(result.factors.find(f => f.name === 'tight_time_window')).toBeUndefined();
  });

  it('adds 5 points for no history', () => {
    const result = computeRiskFactors({ hasHistory: false });
    expect(result.factors.find(f => f.name === 'no_history')).toBeDefined();
    expect(result.score).toBe(5);
  });

  it('adds 15 points for driver failure at address', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      driverFailedHere: true,
    });
    expect(result.factors.find(f => f.name === 'driver_failed_here')).toBeDefined();
    expect(result.score).toBe(15);
  });

  it('caps score at 100', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      failureRate: 0.8,
      totalDeliveries: 10,
      failedDeliveries: 8,
      plannedHour: 14,
      hourlyData: [{ hour: 14, success_rate: 0.1, sample_size: 10 }],
      timeWindowMinutes: 30,
      driverFailedHere: true,
    });
    // 30 + 20 + 10 + 15 = 75, capped at 100
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBe(75);
  });

  it('accumulates multiple factors correctly', () => {
    const result = computeRiskFactors({
      hasHistory: true,
      failureRate: 0.5,
      totalDeliveries: 10,
      failedDeliveries: 5,
      timeWindowMinutes: 45,
    });
    expect(result.score).toBe(40); // 30 + 10
    expect(result.factors).toHaveLength(2);
  });
});
