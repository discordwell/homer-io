import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../lib/email.js';

describe('escapeHtml', () => {
  it('escapes all dangerous HTML characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles mixed content', () => {
    expect(escapeHtml('Tom & Jerry <friends> "forever"')).toBe(
      'Tom &amp; Jerry &lt;friends&gt; &quot;forever&quot;'
    );
  });
});

describe('Password reset token schema', () => {
  it('has required fields for retention cleanup', async () => {
    const { passwordResetTokens } = await import('../lib/db/schema/password-reset-tokens.js');
    expect(passwordResetTokens).toBeDefined();
    expect(passwordResetTokens.createdAt).toBeDefined();
    expect(passwordResetTokens.tokenHash).toBeDefined();
    expect(passwordResetTokens.expiresAt).toBeDefined();
    expect(passwordResetTokens.usedAt).toBeDefined();
  });
});
