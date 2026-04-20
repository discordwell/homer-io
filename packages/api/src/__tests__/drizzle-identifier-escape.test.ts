import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * Regression test for GHSA-gpj5-g38j-94v9 (CVE: SQL injection via improperly escaped
 * SQL identifiers in drizzle-orm < 0.45.2).
 *
 * Prior to 0.45.2, `sql.identifier()` and `sql.as()` did not properly escape the
 * provided value, allowing a caller that forwarded user-derived strings into an
 * identifier position to inject arbitrary SQL. From 0.45.2 onward the PostgreSQL
 * dialect wraps the value in double quotes and escapes embedded double quotes per
 * the SQL standard (`"` -> `""`).
 *
 * These tests pin that behavior so a future dependency downgrade or regression
 * is caught immediately. They compile the SQL against `PgDialect` (no live DB
 * required) and verify the rendered identifier cannot break out of its quoted
 * context even when fed hostile user input.
 */
describe('drizzle-orm identifier escaping (CVE GHSA-gpj5-g38j-94v9)', () => {
  const dialect = new PgDialect();

  const compile = (fragment: ReturnType<typeof sql>) =>
    dialect.sqlToQuery(fragment as unknown as Parameters<typeof dialect.sqlToQuery>[0]);

  it('wraps sql.identifier() values in double quotes', () => {
    const { sql: out, params } = compile(sql`SELECT * FROM ${sql.identifier('users')}`);
    expect(out).toBe('SELECT * FROM "users"');
    expect(params).toEqual([]);
  });

  it('escapes embedded double quotes in identifiers (sql.identifier)', () => {
    // Pre-0.45.2 this would have rendered as: SELECT * FROM "u"; DROP TABLE users; --"
    // allowing the attacker-controlled identifier to terminate the quoted context
    // and inject arbitrary SQL. After the fix, the embedded `"` is doubled.
    const hostile = 'u"; DROP TABLE users; --';
    const { sql: out } = compile(sql`SELECT * FROM ${sql.identifier(hostile)}`);
    expect(out).toBe('SELECT * FROM "u""; DROP TABLE users; --"');
    // And crucially: the identifier context is never terminated early.
    // After the leading `"`, every `"` in the body must be paired.
    const body = out.slice(out.indexOf('"') + 1, out.lastIndexOf('"'));
    const unpairedQuotes = body.match(/(?<!")"(?!")/g);
    expect(unpairedQuotes).toBeNull();
  });

  it('escapes embedded double quotes in aliases (sql``.as)', () => {
    // sql.as() previously shared the same unescaped-identifier flaw. Verify the
    // alias is now safely quoted.
    const hostile = 'alias"; DROP TABLE users; --';
    const aliased = sql`1`.as(hostile);
    // Rendering an aliased SQL fragment as a select field produces `1 as "<alias>"`.
    const { sql: out } = compile(sql`SELECT ${aliased}`);
    expect(out).toContain('"alias""; DROP TABLE users; --"');
    expect(out).not.toContain('"alias";'); // i.e. the attacker-supplied `";` does not escape the quoted context
  });

  it('keeps the identifier context intact for hostile payloads', () => {
    // The attacker payload aims to terminate the quoted identifier early with `"`
    // and inject a trailing statement. After the fix, every embedded `"` is doubled
    // so the identifier context stays a single uninterrupted quoted span.
    const hostile = 'x"; DROP TABLE important; --';
    const { sql: out } = compile(sql`ALTER TABLE ${sql.identifier(hostile)} RENAME TO t2`);
    expect(out).toContain('""'); // embedded quote was doubled
    // There must be exactly two `"` characters that aren't part of a doubled pair —
    // the opening and closing identifier quotes. The hostile payload contains one
    // raw `"`; if it weren't doubled, there would be an odd count of unpaired quotes
    // and the identifier context would leak.
    const withoutDoubled = out.replace(/""/g, '');
    const remainingQuotes = (withoutDoubled.match(/"/g) ?? []).length;
    expect(remainingQuotes).toBe(2);
  });

  it('treats interpolated primitives as parameters, not identifiers', () => {
    // Defense-in-depth: confirm the template-literal tag still parameterizes
    // primitive values instead of splicing them into the SQL text.
    const injected = "'; DROP TABLE users; --";
    const { sql: out, params } = compile(sql`SELECT ${injected}`);
    expect(out).toBe('SELECT $1');
    expect(params).toEqual([injected]);
  });
});
