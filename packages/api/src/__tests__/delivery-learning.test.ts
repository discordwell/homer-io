import { describe, it, expect } from 'vitest';

// Test the failure classification logic directly (extracted from worker)
// The worker uses keyword matching as fast-path classification
const FAILURE_KEYWORDS: Record<string, string[]> = {
  not_home: ['not home', 'no one', 'nobody', 'no answer'],
  wrong_address: ['wrong address', 'incorrect address', 'bad address'],
  access_denied: ['access', 'gate', 'locked', 'no entry'],
  refused: ['refused', 'reject', 'declined'],
  damaged: ['damaged', 'broken'],
  business_closed: ['closed', 'not open', 'business hours'],
  weather: ['weather', 'storm', 'flood', 'snow'],
  vehicle_issue: ['vehicle', 'flat tire', 'broke down', 'mechanical'],
};

function classifyFailureSync(failureReason: string | undefined): string {
  if (!failureReason) return 'other';
  const reason = failureReason.toLowerCase();
  for (const [category, keywords] of Object.entries(FAILURE_KEYWORDS)) {
    if (keywords.some(kw => reason.includes(kw))) return category;
  }
  return 'other';
}

describe('Delivery Learning - Failure Classification', () => {
  it('classifies "nobody home" as not_home', () => {
    expect(classifyFailureSync('Nobody was home')).toBe('not_home');
  });

  it('classifies "no answer at door" as not_home', () => {
    expect(classifyFailureSync('No answer at the door')).toBe('not_home');
  });

  it('classifies "wrong address" correctly', () => {
    expect(classifyFailureSync('Wrong address - building does not exist')).toBe('wrong_address');
  });

  it('classifies "gate locked" as access_denied', () => {
    expect(classifyFailureSync('Gate was locked, could not enter')).toBe('access_denied');
  });

  it('classifies "customer refused" correctly', () => {
    expect(classifyFailureSync('Customer refused delivery')).toBe('refused');
  });

  it('classifies "package damaged" correctly', () => {
    expect(classifyFailureSync('Package was damaged in transit')).toBe('damaged');
  });

  it('classifies "business closed" correctly', () => {
    expect(classifyFailureSync('Business was closed')).toBe('business_closed');
  });

  it('classifies "bad weather" correctly', () => {
    expect(classifyFailureSync('Snow storm, roads impassable')).toBe('weather');
  });

  it('classifies "flat tire" as vehicle_issue', () => {
    expect(classifyFailureSync('Got a flat tire on the way')).toBe('vehicle_issue');
  });

  it('classifies unknown reasons as other', () => {
    expect(classifyFailureSync('Something unusual happened')).toBe('other');
  });

  it('classifies undefined reason as other', () => {
    expect(classifyFailureSync(undefined)).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(classifyFailureSync('NOBODY HOME')).toBe('not_home');
    expect(classifyFailureSync('GATE LOCKED')).toBe('access_denied');
  });
});

describe('Delivery Learning - Address Intelligence Running Averages', () => {
  // Test the incremental average formula used in the worker
  function incrementalAverage(oldAvg: number, oldCount: number, newValue: number): number {
    return ((oldAvg * oldCount) + newValue) / (oldCount + 1);
  }

  it('computes correct incremental average from zero', () => {
    const avg = incrementalAverage(0, 0, 120);
    expect(avg).toBe(120);
  });

  it('computes correct incremental average with history', () => {
    // 3 deliveries averaging 100s, new delivery at 140s
    const avg = incrementalAverage(100, 3, 140);
    expect(avg).toBe(110); // (100*3 + 140) / 4 = 110
  });

  it('converges to true mean over many samples', () => {
    const values = [60, 80, 120, 90, 100, 110, 70, 130, 85, 95];
    let avg = 0;
    for (let i = 0; i < values.length; i++) {
      avg = incrementalAverage(avg, i, values[i]);
    }
    const trueMean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(avg).toBeCloseTo(trueMean, 10);
  });

  // Test hourly pattern tracking
  it('updates hourly success rates correctly', () => {
    interface HourEntry { hour: number; success_rate: number; sample_size: number }
    const patterns: HourEntry[] = [
      { hour: 9, success_rate: 1.0, sample_size: 3 },
      { hour: 14, success_rate: 0.5, sample_size: 2 },
    ];

    // New delivery at hour 9, failed
    const hourEntry = patterns.find(h => h.hour === 9)!;
    const newSampleSize = hourEntry.sample_size + 1;
    const successIncrement = 0; // failed
    hourEntry.success_rate = ((hourEntry.success_rate * hourEntry.sample_size) + successIncrement) / newSampleSize;
    hourEntry.sample_size = newSampleSize;

    expect(hourEntry.success_rate).toBe(0.75); // was 3/3, now 3/4
    expect(hourEntry.sample_size).toBe(4);
  });

  it('adds new hour entry when not seen before', () => {
    interface HourEntry { hour: number; success_rate: number; sample_size: number }
    const patterns: HourEntry[] = [
      { hour: 9, success_rate: 1.0, sample_size: 3 },
    ];

    const completedHour = 15;
    const hourEntry = patterns.find(h => h.hour === completedHour);
    if (!hourEntry) {
      patterns.push({ hour: completedHour, success_rate: 1, sample_size: 1 });
    }

    expect(patterns).toHaveLength(2);
    expect(patterns[1].hour).toBe(15);
    expect(patterns[1].success_rate).toBe(1);
  });
});

describe('Delivery Learning - Failure Reason Tracking', () => {
  it('increments existing failure reason count', () => {
    const reasons = [
      { reason: 'not home', count: 2 },
      { reason: 'gate locked', count: 1 },
    ];

    const failureReason = 'not home';
    const entry = reasons.find(r => r.reason === failureReason);
    if (entry) {
      entry.count += 1;
    }

    expect(reasons[0].count).toBe(3);
  });

  it('adds new failure reason when not seen before', () => {
    const reasons = [
      { reason: 'not home', count: 2 },
    ];

    const failureReason = 'business closed';
    const entry = reasons.find(r => r.reason === failureReason);
    if (!entry) {
      reasons.push({ reason: failureReason, count: 1 });
    }

    expect(reasons).toHaveLength(2);
    expect(reasons[1].reason).toBe('business closed');
    expect(reasons[1].count).toBe(1);
  });
});
