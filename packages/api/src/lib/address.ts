// Re-export from shared — single source of truth for address normalization + hashing
export { normalizeAddress, hashAddress, FAILURE_CATEGORIES } from '@homer-io/shared/address';
export type { AddressComponents, NormalizedAddress, FailureCategory } from '@homer-io/shared/address';
