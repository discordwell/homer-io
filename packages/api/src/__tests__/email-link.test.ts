import { describe, it, expect } from 'vitest';
import { extractDomain, isGenericDomain } from '../modules/auth/domain.js';

describe('Email linking - validation', () => {
  it('rejects linking to a generic email domain', () => {
    expect(isGenericDomain('gmail.com')).toBe(true);
    expect(isGenericDomain('yahoo.com')).toBe(true);
  });

  it('accepts work email domains for linking', () => {
    expect(isGenericDomain('acme.com')).toBe(false);
    expect(isGenericDomain('logistics-co.com')).toBe(false);
  });

  it('extracts domain correctly for link verification', () => {
    expect(extractDomain('jane@acme.com')).toBe('acme.com');
  });
});
