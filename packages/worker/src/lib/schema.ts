// Worker schema — re-exports the canonical API schema to prevent drift.
//
// Historical context: this file used to define minimal `pgTable(...)` duplicates
// of the API's tables. Any column change to the API schema would silently drift
// from the worker's copy, producing runtime errors or corrupt writes. The source
// of truth is now `@homer-io/api/db/schema` (which maps to
// `packages/api/src/lib/db/schema/index.ts`). Any table/enum the worker needs
// must be exported by the canonical schema; add it there, not here.
//
// This file exists only to:
//   1. Re-export the canonical tables/enums for the worker's internal use
//   2. Provide the `routeTemplatesTable` alias that worker code has relied on
//      historically (the canonical name is `routeTemplates`).

export * from '@homer-io/api/db/schema';

// Historical alias — worker code imported `routeTemplatesTable` while API
// exports `routeTemplates`. Keep both names pointing at the same canonical
// object to avoid churn in worker call sites.
import { routeTemplates } from '@homer-io/api/db/schema';
export const routeTemplatesTable = routeTemplates;
