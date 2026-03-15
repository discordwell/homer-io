import { describe, it, expect } from 'vitest';
import { createPodSchema } from '@homer-io/shared';

describe('POD - Schema Validation', () => {
  it('accepts minimal POD input', () => {
    const result = createPodSchema.parse({});
    expect(result.photoUrls).toEqual([]);
  });

  it('accepts full POD input', () => {
    const result = createPodSchema.parse({
      signatureUrl: '/bucket/sig.png',
      photoUrls: ['/bucket/photo1.jpg', '/bucket/photo2.jpg'],
      notes: 'Left at front door',
      recipientNameSigned: 'Jane Doe',
      locationLat: 37.7749,
      locationLng: -122.4194,
    });
    expect(result.signatureUrl).toBe('/bucket/sig.png');
    expect(result.photoUrls).toHaveLength(2);
    expect(result.recipientNameSigned).toBe('Jane Doe');
  });

  it('rejects more than 4 photos', () => {
    expect(() => createPodSchema.parse({
      photoUrls: ['a', 'b', 'c', 'd', 'e'],
    })).toThrow();
  });

  it('rejects invalid latitude', () => {
    expect(() => createPodSchema.parse({
      locationLat: 91,
    })).toThrow();
  });

  it('rejects invalid longitude', () => {
    expect(() => createPodSchema.parse({
      locationLng: -181,
    })).toThrow();
  });

  it('rejects notes exceeding 1000 chars', () => {
    expect(() => createPodSchema.parse({
      notes: 'x'.repeat(1001),
    })).toThrow();
  });

  it('defaults photoUrls to empty array', () => {
    const result = createPodSchema.parse({ signatureUrl: '/sig.png' });
    expect(result.photoUrls).toEqual([]);
  });
});
