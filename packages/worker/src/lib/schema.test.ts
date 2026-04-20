import { describe, it, expect } from 'vitest';
import * as workerSchema from './schema.js';
import * as apiSchema from '@homer-io/api/db/schema';

describe('worker/lib/schema', () => {
  it('re-exports canonical tables from @homer-io/api/db/schema (no duplicate definitions)', () => {
    // Any table the worker needs must also exist in the API schema. If a
    // reference here ever diverges, it's because someone added a table to
    // the worker without adding it to the canonical schema.
    for (const [name, value] of Object.entries(workerSchema)) {
      if (name === 'routeTemplatesTable') continue;
      expect((apiSchema as Record<string, unknown>)[name]).toBe(value);
    }
  });

  it('keeps the routeTemplatesTable alias pointing at canonical routeTemplates', () => {
    expect(workerSchema.routeTemplatesTable).toBe(
      (apiSchema as Record<string, unknown>).routeTemplates,
    );
  });
});
