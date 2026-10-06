"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var FeatureEntitlementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureEntitlementService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const settings_entities_1 = require("./settings.entities");
const feature_usage_entity_1 = require("./feature-usage.entity");
const subscription_plans_1 = require("./subscription-plans");
const FEATURE_LABELS = {
    drafting_mentor: 'Drafting Mentor', case_law_reasoning: 'Case Law Reasoning', mock_test: 'Mock Test Generation', legal_research: 'Legal Research', drafting_academy: 'Drafting Academy',
    lexmentor_ai: 'LexMentor AI', guidebot_ai: 'GuideBot AI', voice_ai: 'Voice AI', bare_act_ai: 'Bare Act AI', document_processing: 'Document Processing', judgment_ai: 'Judgment Intelligence', draft_analysis: 'Draft Analysis', academic_ai: 'Academic AI', memorial_ai: 'Memorial AI',
};
const LIMITED_FEATURES = new Set(['drafting_mentor', 'case_law_reasoning', 'mock_test', 'legal_research', 'drafting_academy']);
let FeatureEntitlementService = FeatureEntitlementService_1 = class FeatureEntitlementService {
    constructor(subscriptions, counters, demoSettings, audits, errors, dataSource) {
        this.subscriptions = subscriptions;
        this.counters = counters;
        this.demoSettings = demoSettings;
        this.audits = audits;
        this.errors = errors;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(FeatureEntitlementService_1.name);
    }
    async getDemoConfig() {
        let setting = await this.demoSettings.findOne({ where: { id: 'global' } });
        if (!setting) {
            setting = this.demoSettings.create({ id: 'global', enabled: true, limitPerFeaturePerDay: this.defaultDemoLimit(), timezone: 'Asia/Kolkata', updatedBy: 'system-bootstrap' });
            try {
                setting = await this.demoSettings.save(setting);
            }
            catch {
                setting = await this.demoSettings.findOne({ where: { id: 'global' } }) || setting;
            }
        }
        return { enabled: setting.enabled, limitPerFeaturePerDay: setting.limitPerFeaturePerDay, timezone: setting.timezone, updatedAt: setting.updatedAt, updatedBy: setting.updatedBy };
    }
    async updateDemoConfig(adminId, input) {
        const before = await this.getDemoConfig();
        const limit = input.limitPerFeaturePerDay ?? before.limitPerFeaturePerDay;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
            throw new common_1.HttpException('Demo limit must be a whole number between 1 and 100.', common_1.HttpStatus.BAD_REQUEST);
        const saved = await this.demoSettings.save(this.demoSettings.create({ id: 'global', enabled: input.enabled ?? before.enabled, limitPerFeaturePerDay: limit, timezone: 'Asia/Kolkata', updatedBy: adminId }));
        await this.audits.save(this.audits.create({
            adminId,
            action: saved.enabled === before.enabled ? 'DEMO_LIMIT_CHANGED' : (saved.enabled ? 'DEMO_MODE_ENABLED' : 'DEMO_MODE_DISABLED'),
            oldValue: { enabled: before.enabled, limitPerFeaturePerDay: before.limitPerFeaturePerDay },
            newValue: { enabled: saved.enabled, limitPerFeaturePerDay: saved.limitPerFeaturePerDay },
        }));
        return this.getDemoConfig();
    }
    async getUsage(userId, feature) {
        const subscription = await this.ensureSubscription(userId);
        const config = await this.getDemoConfig();
        if (config.enabled) {
            const periodKey = `demo:day:${this.calendarDate(config.timezone)}`;
            const counter = await this.counters.findOne({ where: { userId, featureKey: feature, periodKey } });
            const used = Number(counter?.usedCount || 0);
            return { feature, label: FEATURE_LABELS[feature], mode: 'demo', used, limit: config.limitPerFeaturePerDay, remaining: Math.max(0, config.limitPerFeaturePerDay - used), reset: 'daily', timezone: config.timezone };
        }
        const plan = this.resolveActivePlan(subscription);
        if (!LIMITED_FEATURES.has(feature))
            return { feature, label: FEATURE_LABELS[feature], mode: 'subscription', plan, used: 0, limit: null, remaining: null };
        const entitlement = subscription_plans_1.SUBSCRIPTION_PLANS[plan].entitlements[feature];
        const periodKey = this.periodKey(plan, entitlement.reset, subscription);
        const counter = await this.counters.findOne({ where: { userId, featureKey: feature, periodKey } });
        const used = Number(counter?.usedCount || 0);
        return { feature, label: FEATURE_LABELS[feature], mode: 'subscription', plan, used, limit: entitlement.limit, remaining: entitlement.limit === null ? null : Math.max(0, entitlement.limit - used), reset: entitlement.reset };
    }
    async reserve(userId, feature) {
        const subscription = await this.ensureSubscription(userId);
        const config = await this.getDemoConfig();
        if (config.enabled)
            return this.atomicReserve(userId, feature, 'demo', `demo:day:${this.calendarDate(config.timezone)}`, config.limitPerFeaturePerDay);
        const planId = this.resolveActivePlan(subscription);
        if (!LIMITED_FEATURES.has(feature))
            return { counterId: null, feature, unlimited: true, mode: 'subscription', limit: null, used: 0, periodKey: null };
        const entitlement = subscription_plans_1.SUBSCRIPTION_PLANS[planId].entitlements[feature];
        if (entitlement.limit === null)
            return { counterId: null, feature, unlimited: true, mode: 'subscription', limit: null, used: 0, periodKey: null };
        return this.atomicReserve(userId, feature, planId, this.periodKey(planId, entitlement.reset, subscription), entitlement.limit, entitlement.reset);
    }
    async refund(reservation) {
        if (!reservation?.counterId || reservation.unlimited)
            return;
        await this.counters.createQueryBuilder().update(feature_usage_entity_1.FeatureUsageCounter).set({ usedCount: () => 'CASE WHEN used_count > 0 THEN used_count - 1 ELSE 0 END' }).where('id = :id', { id: reservation.counterId }).execute();
    }
    async recordApiError(userId, feature, error) {
        const status = Number(error?.status || error?.statusCode || error?.response?.status || 0) || null;
        const code = String(error?.code || error?.response?.data?.code || error?.name || 'PROVIDER_ERROR').slice(0, 100);
        try {
            await this.errors.save(this.errors.create({ userId, featureKey: feature, errorCode: code, httpStatus: status }));
        }
        catch (writeError) {
            this.logger.warn(`Could not persist API failure metric: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
        }
    }
    async getAdminOverview() {
        const config = await this.getDemoConfig();
        const date = this.calendarDate(config.timezone);
        const periodKey = `demo:day:${date}`;
        const rows = await this.counters.createQueryBuilder('counter').where('counter.periodKey = :periodKey', { periodKey }).orderBy('counter.usedCount', 'DESC').getMany();
        const byFeature = new Map();
        for (const row of rows)
            byFeature.set(row.featureKey, (byFeature.get(row.featureKey) || 0) + Number(row.usedCount || 0));
        const [apiErrorsToday, totalUsers] = await Promise.all([
            this.errors.createQueryBuilder('error').where('error.createdAt >= :start', { start: this.startOfIndiaDayUtc() }).getCount(),
            this.subscriptions.count(),
        ]);
        return { ...config, date, totalUsers, todayUsage: rows.reduce((sum, row) => sum + Number(row.usedCount || 0), 0), activeUsers: new Set(rows.map((row) => row.userId)).size, usersReachingLimits: new Set(rows.filter((row) => row.usedCount >= config.limitPerFeaturePerDay).map((row) => row.userId)).size, apiErrorsToday, topFeatures: [...byFeature.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([feature, uses]) => ({ feature, label: FEATURE_LABELS[feature] || feature, uses })) };
    }
    async atomicReserve(userId, feature, planKey, periodKey, limit, reset = 'daily') {
        const id = (0, crypto_1.randomUUID)();
        const table = this.counters.metadata.tableName;
        let rows;
        if (this.dataSource.options.type === 'postgres') {
            rows = await this.dataSource.query(`INSERT INTO "${table}" (id,user_id,feature_key,plan_key,period_key,used_count,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,1,NOW(),NOW()) ON CONFLICT (user_id,feature_key,period_key) DO UPDATE SET used_count="${table}".used_count+1,updated_at=NOW() WHERE "${table}".used_count<$6 RETURNING id,used_count`, [id, userId, feature, planKey, periodKey, limit]);
        }
        else {
            rows = await this.dataSource.query(`INSERT INTO "${table}" (id,user_id,feature_key,plan_key,period_key,used_count,created_at,updated_at) VALUES (?,?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (user_id,feature_key,period_key) DO UPDATE SET used_count=used_count+1,updated_at=CURRENT_TIMESTAMP WHERE used_count<? RETURNING id,used_count`, [id, userId, feature, planKey, periodKey, limit]);
        }
        const row = rows?.[0];
        if (!row)
            throw this.limitException(feature, planKey, limit, reset);
        return { counterId: row.id, feature, unlimited: false, mode: planKey === 'demo' ? 'demo' : 'subscription', limit, used: Number(row.used_count), periodKey };
    }
    resolveActivePlan(subscription) {
        if (!subscription || subscription.status !== 'active')
            return 'free';
        const plan = (0, subscription_plans_1.normalizeSubscriptionPlan)(subscription.planName);
        if (plan !== 'free' && subscription.renewalDate && new Date(subscription.renewalDate).getTime() < Date.now())
            return 'free';
        return plan;
    }
    async ensureSubscription(userId) {
        const existing = await this.subscriptions.findOne({ where: { userId } });
        if (existing)
            return existing;
        const free = this.subscriptions.create({ userId, planName: 'free', status: 'active', renewalDate: null, aiCreditsLimit: subscription_plans_1.SUBSCRIPTION_PLANS.free.aiCredits, aiCreditsUsed: 0 });
        try {
            return await this.subscriptions.save(free);
        }
        catch {
            const concurrent = await this.subscriptions.findOne({ where: { userId } });
            if (concurrent)
                return concurrent;
            throw new common_1.HttpException('Unable to initialize the user subscription.', common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    periodKey(plan, reset, subscription) {
        if (reset === 'lifetime')
            return `${plan}:lifetime`;
        if (reset === 'billing_cycle')
            return `${plan}:cycle:${subscription?.renewalDate?.toISOString?.() || 'current'}`;
        return `${plan}:day:${this.calendarDate('Asia/Kolkata')}`;
    }
    calendarDate(timezone) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const value = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${value.year}-${value.month}-${value.day}`; }
    startOfIndiaDayUtc() { return new Date(`${this.calendarDate('Asia/Kolkata')}T00:00:00+05:30`); }
    defaultDemoLimit() { const parsed = Number(process.env.DEMO_LIMIT_PER_FEATURE_PER_DAY || 4); return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 4; }
    limitException(feature, plan, limit, reset) {
        const label = FEATURE_LABELS[feature];
        if (plan === 'demo')
            return new common_1.HttpException({ code: 'DEMO_LIMIT_REACHED', message: `You have used all ${limit} free demo uses for ${label} today. Please try again tomorrow or choose a LEGATRIXON plan.`, feature, mode: 'demo', limit, used: limit, remaining: 0, reset: 'daily', timezone: 'Asia/Kolkata', action: { label: 'View Plans', href: '/pricing' } }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        return new common_1.HttpException({ code: 'FEATURE_LIMIT_REACHED', message: `You've used all ${limit} ${label} uses included in your plan.`, feature, plan, limit, reset, action: { label: 'View Plans', href: '/pricing' } }, common_1.HttpStatus.PAYMENT_REQUIRED);
    }
};
exports.FeatureEntitlementService = FeatureEntitlementService;
exports.FeatureEntitlementService = FeatureEntitlementService = FeatureEntitlementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(settings_entities_1.UserSubscription)),
    __param(1, (0, typeorm_1.InjectRepository)(feature_usage_entity_1.FeatureUsageCounter)),
    __param(2, (0, typeorm_1.InjectRepository)(feature_usage_entity_1.DemoModeSetting)),
    __param(3, (0, typeorm_1.InjectRepository)(feature_usage_entity_1.DemoModeAuditLog)),
    __param(4, (0, typeorm_1.InjectRepository)(feature_usage_entity_1.ApiUsageError)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], FeatureEntitlementService);
//# sourceMappingURL=feature-entitlement.service.js.map