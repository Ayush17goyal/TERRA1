import { FeatureEntitlementService } from './feature-entitlement.service';

function createHarness(planName = 'free', demoEnabled = false, demoLimit = 4) {
  const subscriptions = new Map<string, any>([['user-1', { userId: 'user-1', planName, status: 'active', renewalDate: planName === 'free' ? null : new Date('2026-11-01T00:00:00.000Z') }]]);
  const counters: any[] = [];
  const settings: any = { id: 'global', enabled: demoEnabled, limitPerFeaturePerDay: demoLimit, timezone: 'Asia/Kolkata', updatedBy: 'test' };
  const repo = (items: any[]) => ({
    metadata: { tableName: 'feature_usage_counters' },
    findOne: async ({ where }: any) => items.find((item) => Object.entries(where).every(([key, value]) => item[key] === value)) || null,
    create: (value: any) => ({ ...value }),
    save: async (value: any) => { const index = items.findIndex((item) => item.id === value.id); if (index >= 0) items[index] = value; else items.push(value); return value; },
    createQueryBuilder: () => ({ update() { return this; }, set() { return this; }, where() { return this; }, async execute() { return {}; }, orderBy() { return this; }, async getMany() { return items; }, async getCount() { return items.length; } }),
  });
  const subscriptionRepo = { findOne: async ({ where }: any) => subscriptions.get(where.userId) || null, create: (value: any) => value, save: async (value: any) => { subscriptions.set(value.userId, value); return value; }, count: async () => subscriptions.size };
  const counterRepo: any = repo(counters);
  counterRepo.createQueryBuilder = () => ({ update() { return this; }, set() { return this; }, where(_sql: string, args: any) { const row = counters.find((item) => item.id === args.id); if (row) row.usedCount = Math.max(0, row.usedCount - 1); return this; }, async execute() { return {}; }, orderBy() { return this; }, async getMany() { return counters; } });
  const settingRepo: any = { findOne: async () => settings, create: (value: any) => value, save: async (value: any) => Object.assign(settings, value) };
  const auditRepo: any = repo([]);
  const errorRepo: any = repo([]);
  const dataSource: any = {
    options: { type: 'postgres' },
    query: async (_sql: string, params: any[]) => {
      const [, userId, feature, planKey, periodKey, limit] = params;
      let counter = counters.find((item) => item.userId === userId && item.featureKey === feature && item.periodKey === periodKey);
      if (counter && counter.usedCount >= limit) return [];
      if (!counter) { counter = { id: params[0], userId, featureKey: feature, planKey, periodKey, usedCount: 0 }; counters.push(counter); }
      counter.usedCount += 1;
      return [{ id: counter.id, used_count: counter.usedCount }];
    },
  };
  return { service: new FeatureEntitlementService(subscriptionRepo as any, counterRepo, settingRepo, auditRepo, errorRepo, dataSource), counters, settings };
}

async function consume(service: FeatureEntitlementService, feature: any, count: number, userId = 'user-1') { for (let index = 0; index < count; index += 1) await service.reserve(userId, feature); }

describe('FeatureEntitlementService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('locks the Command Center for accounts without developer metadata', () => {
    const { service } = createHarness();
    expect(service.getLegalResearchCommandCenterAccess({ trustedRole: null, privateEntitlements: {} })).toEqual({
      feature: 'LEGAL_RESEARCH_COMMAND_CENTER',
      allowed: false,
      source: 'locked',
    });
  });

  it('allows an explicitly entitled developer', () => {
    const { service } = createHarness();
    expect(service.getLegalResearchCommandCenterAccess({
      trustedRole: 'developer',
      privateEntitlements: { LEGAL_RESEARCH_COMMAND_CENTER_ACCESS: true },
    })).toEqual({
      feature: 'LEGAL_RESEARCH_COMMAND_CENTER',
      allowed: true,
      source: 'explicit_entitlement',
    });
  });

  it('does not allow a developer role without the explicit entitlement', () => {
    const { service } = createHarness();
    expect(service.getLegalResearchCommandCenterAccess({ trustedRole: 'developer', privateEntitlements: {} }).allowed).toBe(false);
  });

  it('does not allow an entitlement without the developer role', () => {
    const { service } = createHarness();
    expect(service.getLegalResearchCommandCenterAccess({
      trustedRole: 'customer',
      privateEntitlements: { LEGAL_RESEARCH_COMMAND_CENTER_ACCESS: true },
    }).allowed).toBe(false);
  });

  it('does not treat other privileged roles as the required developer role', () => {
    const { service } = createHarness();
    expect(service.getLegalResearchCommandCenterAccess({
      trustedRole: 'admin',
      privateEntitlements: { LEGAL_RESEARCH_COMMAND_CENTER_ACCESS: true },
    }).allowed).toBe(false);
  });

  it('accepts an administrator-controlled public metadata entitlement', () => {
    const { service } = createHarness();
    expect(service.getLegalResearchCommandCenterAccess({
      trustedRole: 'developer',
      trustedEntitlements: { LEGAL_RESEARCH_COMMAND_CENTER_ACCESS: true },
    })).toMatchObject({ allowed: true, source: 'explicit_entitlement' });
  });

  it('stays locked even if the removed legacy global flag is present', () => {
    process.env.LEGAL_RESEARCH_COMMAND_CENTER_ENABLED = 'true';
    const { service } = createHarness();
    expect(service.getLegalResearchCommandCenterAccess({ trustedRole: null, privateEntitlements: {} })).toMatchObject({
      allowed: false,
      source: 'locked',
    });
    delete process.env.LEGAL_RESEARCH_COMMAND_CENTER_ENABLED;
  });

  it('does not count legal research usage for an explicitly entitled developer', async () => {
    const { service, counters } = createHarness('free', false, 1);
    const reservation = await service.reserve('user-1', 'legal_research', {
      trustedRole: 'developer',
      privateEntitlements: { LEGAL_RESEARCH_COMMAND_CENTER_ACCESS: true },
    });
    expect(reservation).toMatchObject({ unlimited: true, counterId: null });
    expect(counters).toHaveLength(0);
  });

  it('enforces demo limits independently per user and feature', async () => {
    const { service } = createHarness('pro-max', true, 4);
    await consume(service, 'legal_research', 4);
    await expect(service.reserve('user-1', 'legal_research')).rejects.toMatchObject({ status: 429 });
    await expect(service.reserve('user-2', 'legal_research')).resolves.toMatchObject({ used: 1, mode: 'demo' });
    await expect(service.reserve('user-1', 'mock_test')).resolves.toMatchObject({ used: 1, mode: 'demo' });
  });

  it('resets demo usage on the next India calendar day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-06T18:29:00.000Z'));
    const { service } = createHarness('free', true, 1);
    await service.reserve('user-1', 'lexmentor_ai');
    await expect(service.reserve('user-1', 'lexmentor_ai')).rejects.toMatchObject({ status: 429 });
    jest.setSystemTime(new Date('2026-10-06T18:31:00.000Z'));
    await expect(service.reserve('user-1', 'lexmentor_ai')).resolves.toMatchObject({ used: 1 });
  });

  it('allows at most four concurrent reservations for the same user and feature', async () => {
    const { service, counters } = createHarness('free', true, 4);
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => service.reserve('user-1', 'legal_research')));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(4);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(8);
    expect(counters[0].usedCount).toBe(4);
  });

  it('returns immediately to normal subscription rules when demo mode is disabled', async () => {
    const { service, settings } = createHarness('starter', true, 1);
    await service.reserve('user-1', 'case_law_reasoning');
    await expect(service.reserve('user-1', 'case_law_reasoning')).rejects.toMatchObject({ status: 429 });
    settings.enabled = false;
    await expect(service.reserve('user-1', 'case_law_reasoning')).resolves.toMatchObject({ mode: 'subscription', used: 1 });
  });

  it('refunds a reservation when downstream execution fails', async () => {
    const { service, counters } = createHarness('free', true, 1);
    const reservation = await service.reserve('user-1', 'mock_test');
    await service.refund(reservation);
    expect(counters[0].usedCount).toBe(0);
    await expect(service.reserve('user-1', 'mock_test')).resolves.toBeDefined();
  });
});
