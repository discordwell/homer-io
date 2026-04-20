import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Structural tests for the CSP meta tag in index.html.
 *
 * The header is set in the source HTML (and duplicated at the edge by Caddy).
 * These tests catch regressions where someone accidentally strips or loosens
 * the policy.
 */

const indexHtml = readFileSync(
  resolve(__dirname, '..', 'index.html'),
  'utf-8',
);

function extractCsp(html: string): string {
  // Match: <meta ... http-equiv="Content-Security-Policy" ... content="..."...>
  // Use a non-greedy [\s\S]*? span for attributes so we don't care about
  // attribute order, and require the content attribute to use DOUBLE quotes
  // (matches our index.html). CSP values contain single quotes like 'self',
  // so matching content in double quotes is the only safe option.
  const match = html.match(
    /<meta\b[\s\S]*?http-equiv\s*=\s*"Content-Security-Policy"[\s\S]*?content\s*=\s*"([^"]+)"[\s\S]*?>/i,
  );
  if (!match) throw new Error('CSP meta tag not found in index.html');
  return match[1];
}

describe('Content Security Policy', () => {
  it('has a CSP meta tag', () => {
    expect(() => extractCsp(indexHtml)).not.toThrow();
  });

  const csp = extractCsp(indexHtml);

  it("sets default-src to 'self'", () => {
    expect(csp).toMatch(/default-src\s+'self'/);
  });

  it('does NOT allow unsafe-eval in script-src (security regression guard)', () => {
    const scriptSrc = csp.match(/script-src[^;]*/)?.[0] ?? '';
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("does NOT allow 'unsafe-inline' in script-src", () => {
    const scriptSrc = csp.match(/script-src[^;]*/)?.[0] ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('allows Google OAuth origins for sign-in', () => {
    expect(csp).toContain('https://accounts.google.com');
  });

  it('allows MapTiler for the hero map', () => {
    expect(csp).toContain('https://api.maptiler.com');
  });

  it("sets frame-ancestors 'none' (clickjacking protection)", () => {
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
  });

  it("sets base-uri 'self'", () => {
    expect(csp).toMatch(/base-uri\s+'self'/);
  });

  it("sets form-action 'self'", () => {
    expect(csp).toMatch(/form-action\s+'self'/);
  });

  it("sets object-src 'none'", () => {
    expect(csp).toMatch(/object-src\s+'none'/);
  });

  it('allows images from data:, blob:, and https: (for MinIO presigned URLs)', () => {
    expect(csp).toMatch(/img-src[^;]*data:/);
    expect(csp).toMatch(/img-src[^;]*blob:/);
    expect(csp).toMatch(/img-src[^;]*\bhttps:/);
  });

  it('allows wss:/ws: for Socket.IO connections', () => {
    expect(csp).toMatch(/connect-src[^;]*\bwss:/);
  });
});
