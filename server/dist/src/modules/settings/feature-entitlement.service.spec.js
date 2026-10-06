"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const feature_entitlement_service_1 = require("./feature-entitlement.service");
function createHarness(planName = 'free', demoEnabled = false, demoLimit = 4) {
    const subscriptions = new Map([['user-1', { userId: 'user-1', planName, status: 'active', renewalDate: planName === 'free' ? null : new Date('2026-11-01T00:00:00.000Z') }]]);
    const counters = [];
    const settings = { id: 'global', enabled: demoEnabled, limitPerFeaturePerDay: demoLimit, timezone: 'Asia/Kolkata', updatedBy: 'test' };
    const repo = (items) => ({
        metadata: { tableName: 'feature_usage_counters' },
        findOne: async ({ where }) => items.find((item) => Object.entries(where).every(([key, value]) => item[key] === value)) || null,
        create: (value) => ({ ...value }),
        save: async (value) => { const index = items.findIndex((item) => item.id === value.id); if (index >= 0)
            items[index] = value;
        else
            items.push(value); return value; },
        createQueryBuilder: () => ({ update() { return this; }, set() { return this; }, where() { return this; }, async execute() { return {}; }, orderBy() { return this; }, async getMany() { return items; }, async getCount() { return items.length; } }),
    });
    const subscriptionRepo = { findOne: async ({ where }) => subscriptions.get(where.userId) || null, create: (value) => value, save: async (value) => { subscriptions.set(value.userId, value); return value; }, count: async () => subscriptions.size };
    const counterRepo = repo(counters);
    counterRepo.createQueryBuilder = () => ({ update() { return this; }, set() { return this; }, where(_sql, args) { const row = counters.find((item) => item.id === args.id); if (row)
            row.usedCount = Math.max(0, row.usedCount - 1); return this; }, async execute() { return {}; }, orderBy() { return this; }, async getMany() { return counters; } });
    const settingRepo = { findOne: async () => settings, create: (value) => value, save: async (value) => Object.assign(settings, value) };
    const auditRepo = repo([]);
    const errorRepo = repo([]);
    const dataSource = {
        options: { type: 'postgres' },
        query: async (_sql, params) => {
            const [, userId, feature, planKey, periodKey, limit] = params;
            let counter = counters.find((item) => item.userId === userId && item.featureKey === feature && item.periodKey === periodKey);
            if (counter && counter.usedCount >= limit)
                return [];
            if (!counter) {
                counter = { id: params[0], userId, featureKey: feature, planKey, periodKey, usedCount: 0 };
                counters.push(counter);
            }
            counter.usedCount += 1;
            return [{ id: counter.id, used_count: counter.usedCount }];
        },
    };
    return { service: new feature_entitlement_service_1.FeatureEntitlementService(subscriptionRepo, counterRepo, settingRepo, auditRepo, errorRepo, dataSource), counters, settings };
}
async function consume(service, feature, count, userId = 'user-1') { for (let index = 0; index < count; index += 1)
    await service.reserve(userId, feature); }
describe('FeatureEntitlementService', () => {
    afterEach(() => jest.useRealTimers());
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
//# sourceMappingURL=feature-entitlement.service.spec.js.map