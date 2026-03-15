import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../lib/db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ onboardingCompletedAt: null }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../lib/db/schema/tenants.js', () => ({ tenants: { id: 'id', onboardingCompletedAt: 'onboarding_completed_at', updatedAt: 'updated_at' } }));
vi.mock('../../lib/db/schema/vehicles.js', () => ({ vehicles: { tenantId: 'tenant_id' } }));
vi.mock('../../lib/db/schema/drivers.js', () => ({ drivers: { tenantId: 'tenant_id' } }));
vi.mock('../../lib/db/schema/orders.js', () => ({ orders: { tenantId: 'tenant_id' } }));
vi.mock('../../lib/db/schema/routes.js', () => ({ routes: { tenantId: 'tenant_id' } }));
vi.mock('../../lib/db/schema/notification-templates.js', () => ({ notificationTemplates: { tenantId: 'tenant_id' } }));

describe('Onboarding', () => {
  it('should be importable', async () => {
    const mod = await import('../modules/onboarding/service.js');
    expect(mod.getOnboardingStatus).toBeDefined();
    expect(mod.completeOnboarding).toBeDefined();
    expect(mod.skipOnboarding).toBeDefined();
  });
});
