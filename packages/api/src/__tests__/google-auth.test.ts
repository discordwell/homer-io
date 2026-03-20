import { describe, it, expect } from 'vitest';

describe('Google Auth - Schema columns', () => {
  it('users table has googleId column defined', async () => {
    const { users } = await import('../lib/db/schema/users.js');
    expect(users.googleId).toBeDefined();
  });

  it('users table has avatarUrl column defined', async () => {
    const { users } = await import('../lib/db/schema/users.js');
    expect(users.avatarUrl).toBeDefined();
  });

  it('tenants table has orgDomain column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.orgDomain).toBeDefined();
  });

  it('tenants table has autoJoinEnabled column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.autoJoinEnabled).toBeDefined();
  });

  it('tenants table has isDemo column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.isDemo).toBeDefined();
  });
});
