import { describe, it, expect } from 'vitest';
import { isDisposableEmail, DISPOSABLE_DOMAINS } from '../modules/auth/disposable-domains.js';

describe('isDisposableEmail', () => {
  it('blocks mailinator.com', () => {
    expect(isDisposableEmail('test@mailinator.com')).toBe(true);
  });

  it('blocks yopmail.com', () => {
    expect(isDisposableEmail('someone@yopmail.com')).toBe(true);
  });

  it('blocks guerrillamail.com', () => {
    expect(isDisposableEmail('throwaway@guerrillamail.com')).toBe(true);
  });

  it('blocks tempmail.com', () => {
    expect(isDisposableEmail('foo@tempmail.com')).toBe(true);
  });

  it('blocks 10minutemail.com', () => {
    expect(isDisposableEmail('bar@10minutemail.com')).toBe(true);
  });

  it('blocks maildrop.cc', () => {
    expect(isDisposableEmail('x@maildrop.cc')).toBe(true);
  });

  it('allows gmail.com', () => {
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
  });

  it('allows company.com', () => {
    expect(isDisposableEmail('jane@company.com')).toBe(false);
  });

  it('allows outlook.com', () => {
    expect(isDisposableEmail('user@outlook.com')).toBe(false);
  });

  it('allows homer.io', () => {
    expect(isDisposableEmail('admin@homer.io')).toBe(false);
  });

  it('is case-insensitive on domain', () => {
    expect(isDisposableEmail('test@MAILINATOR.COM')).toBe(true);
    expect(isDisposableEmail('test@YopMail.Com')).toBe(true);
  });

  it('blocks subdomains of disposable domains', () => {
    expect(isDisposableEmail('test@sub.mailinator.com')).toBe(true);
    expect(isDisposableEmail('test@foo.bar.yopmail.com')).toBe(true);
    expect(isDisposableEmail('test@inbox.guerrillamail.com')).toBe(true);
  });

  it('does not block legitimate domains ending with blocked suffix', () => {
    // "notmailinator.com" should NOT be blocked just because "mailinator.com" is blocked
    expect(isDisposableEmail('test@notmailinator.com')).toBe(false);
  });

  it('returns false for malformed email (no @)', () => {
    expect(isDisposableEmail('nodomain')).toBe(false);
  });

  it('blocklist has at least 80 domains', () => {
    expect(DISPOSABLE_DOMAINS.size).toBeGreaterThanOrEqual(80);
  });
});
