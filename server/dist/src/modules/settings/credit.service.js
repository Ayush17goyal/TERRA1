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
var CreditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = exports.FREE_PLAN_CREDITS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const credit_entity_1 = require("./credit.entity");
exports.FREE_PLAN_CREDITS = {
    lexmentor: { label: 'LexMentor', credits: 100 },
    legal_research: { label: 'Legal Research', credits: 25 },
    memorial_architect: { label: 'Memorial Architect', credits: 10 },
    judgment_mastery: { label: 'Judgment Mastery', credits: 20 },
    lexnotebook: { label: 'LexNotebook', credits: 50 },
    smart_study_forge: { label: 'Smart Study Forge', credits: 50 },
    bench_simulator: { label: 'Bench Simulator', credits: 20 },
};
let CreditService = CreditService_1 = class CreditService {
    constructor(entitlementRepo, balanceRepo, transactionRepo) {
        this.entitlementRepo = entitlementRepo;
        this.balanceRepo = balanceRepo;
        this.transactionRepo = transactionRepo;
        this.logger = new common_1.Logger(CreditService_1.name);
    }
    normalizeModule(moduleName) {
        const normalized = String(moduleName || '').toLowerCase();
        if (normalized.includes('research'))
            return 'legal_research';
        if (normalized.includes('memorial'))
            return 'memorial_architect';
        if (normalized.includes('judgment'))
            return 'judgment_mastery';
        if (normalized.includes('studyforge') || normalized.includes('study_forge'))
            return 'smart_study_forge';
        if (normalized.includes('notebook'))
            return 'lexnotebook';
        if (normalized.includes('bench') || normalized.includes('moot'))
            return 'bench_simulator';
        return 'lexmentor';
    }
    async ensureFreeCredits(userId) {
        if (!userId)
            return [];
        await this.ensureFreeEntitlements();
        const existing = await this.balanceRepo.find({ where: { userId } });
        const existingKeys = new Set(existing.map((balance) => balance.moduleKey));
        const created = [];
        for (const [moduleKey, config] of Object.entries(exports.FREE_PLAN_CREDITS)) {
            if (existingKeys.has(moduleKey))
                continue;
            const balance = this.balanceRepo.create({
                userId,
                moduleKey,
                planKey: 'free',
                creditsGranted: config.credits,
                creditsUsed: 0,
                creditsRemaining: config.credits,
                resetPeriod: 'lifetime',
                resetAt: null,
            });
            const saved = await this.balanceRepo.save(balance);
            created.push(saved);
            await this.transactionRepo.save(this.transactionRepo.create({
                userId,
                moduleKey,
                requestId: null,
                transactionType: 'grant',
                amount: config.credits,
                source: 'free_plan',
                providerUsed: null,
                cacheStatus: null,
                metadata: { label: config.label },
            }));
        }
        return created.length ? [...existing, ...created] : existing;
    }
    async getCreditSummary(userId) {
        const balances = await this.ensureFreeCredits(userId);
        return balances
            .sort((a, b) => this.getSortIndex(a.moduleKey) - this.getSortIndex(b.moduleKey))
            .map((balance) => ({
            moduleKey: balance.moduleKey,
            label: exports.FREE_PLAN_CREDITS[balance.moduleKey]?.label || balance.moduleKey,
            planKey: balance.planKey,
            creditsGranted: Number(balance.creditsGranted || 0),
            creditsUsed: Number(balance.creditsUsed || 0),
            creditsRemaining: Number(balance.creditsRemaining || 0),
            resetPeriod: balance.resetPeriod,
            resetAt: balance.resetAt,
        }));
    }
    async reserveForSystemProvider(userId, moduleName) {
        const moduleKey = this.normalizeModule(moduleName);
        if (!userId)
            return { route: 'system', moduleKey, transactionId: null, unlimited: false };
        if (process.env.ALLOW_DEV_AUTH_BYPASS === 'true') {
            return { route: 'system', moduleKey, transactionId: null, unlimited: true };
        }
        await this.ensureFreeCredits(userId);
        const balance = await this.balanceRepo.findOne({ where: { userId, moduleKey } });
        if (!balance)
            return { route: 'byok', moduleKey, reason: 'credits_exhausted' };
        if (Number(balance.creditsRemaining || 0) <= 0) {
            await this.recordLimitReached(userId, moduleKey);
            return { route: 'byok', moduleKey, reason: 'credits_exhausted' };
        }
        balance.creditsUsed = Number(balance.creditsUsed || 0) + 1;
        balance.creditsRemaining = Math.max(0, Number(balance.creditsRemaining || 0) - 1);
        await this.balanceRepo.save(balance);
        const transaction = await this.transactionRepo.save(this.transactionRepo.create({
            userId,
            moduleKey,
            requestId: null,
            transactionType: 'consume',
            amount: 1,
            source: balance.planKey || 'free_plan',
            providerUsed: 'legatrixon',
            cacheStatus: 'miss',
            metadata: { remaining: balance.creditsRemaining },
        }));
        return { route: 'system', moduleKey, transactionId: transaction.id, unlimited: false };
    }
    async refundReservation(userId, reservation, reason) {
        if (!userId || !reservation || reservation.route !== 'system' || reservation.unlimited)
            return;
        const balance = await this.balanceRepo.findOne({ where: { userId, moduleKey: reservation.moduleKey } });
        if (!balance)
            return;
        balance.creditsUsed = Math.max(0, Number(balance.creditsUsed || 0) - 1);
        balance.creditsRemaining = Number(balance.creditsRemaining || 0) + 1;
        await this.balanceRepo.save(balance);
        await this.transactionRepo.save(this.transactionRepo.create({
            userId,
            moduleKey: reservation.moduleKey,
            requestId: reservation.transactionId,
            transactionType: 'refund',
            amount: 1,
            source: balance.planKey || 'free_plan',
            providerUsed: 'legatrixon',
            cacheStatus: null,
            metadata: { reason },
        }));
    }
    createLimitReachedException(moduleKey) {
        const label = exports.FREE_PLAN_CREDITS[moduleKey]?.label || 'AI';
        return new common_1.HttpException({
            code: 'AI_CREDITS_EXHAUSTED',
            message: `You have used your free ${label} credits.`,
            moduleKey,
            moduleLabel: label,
            actions: ['upgrade_plan', 'use_own_ai_provider'],
        }, common_1.HttpStatus.PAYMENT_REQUIRED);
    }
    async ensureFreeEntitlements() {
        for (const [moduleKey, config] of Object.entries(exports.FREE_PLAN_CREDITS)) {
            const exists = await this.entitlementRepo.findOne({ where: { planKey: 'free', moduleKey } });
            if (exists)
                continue;
            await this.entitlementRepo.save(this.entitlementRepo.create({
                planKey: 'free',
                moduleKey,
                creditLimit: config.credits,
                resetPeriod: 'lifetime',
                isUnlimited: false,
                fairUsageLimit: 0,
            }));
        }
    }
    async recordLimitReached(userId, moduleKey) {
        await this.transactionRepo.save(this.transactionRepo.create({
            userId,
            moduleKey,
            requestId: null,
            transactionType: 'limit_reached',
            amount: 0,
            source: 'free_plan',
            providerUsed: null,
            cacheStatus: 'miss',
            metadata: { reason: 'credits_exhausted' },
        }));
    }
    getSortIndex(moduleKey) {
        return Object.keys(exports.FREE_PLAN_CREDITS).indexOf(moduleKey);
    }
};
exports.CreditService = CreditService;
exports.CreditService = CreditService = CreditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(credit_entity_1.AiPlanEntitlement)),
    __param(1, (0, typeorm_1.InjectRepository)(credit_entity_1.UserAiCreditBalance)),
    __param(2, (0, typeorm_1.InjectRepository)(credit_entity_1.AiCreditTransaction)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CreditService);
//# sourceMappingURL=credit.service.js.map