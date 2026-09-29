import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiCreditTransaction, AiPlanEntitlement, UserAiCreditBalance } from './credit.entity';

export type AiCreditModuleKey =
  | 'lexmentor'
  | 'legal_research'
  | 'memorial_architect'
  | 'judgment_mastery'
  | 'lexnotebook'
  | 'smart_study_forge'
  | 'bench_simulator';

export const FREE_PLAN_CREDITS: Record<AiCreditModuleKey, { label: string; credits: number }> = {
  lexmentor: { label: 'LexMentor', credits: 100 },
  legal_research: { label: 'Legal Research', credits: 25 },
  memorial_architect: { label: 'Memorial Architect', credits: 10 },
  judgment_mastery: { label: 'Judgment Mastery', credits: 20 },
  lexnotebook: { label: 'LexNotebook', credits: 50 },
  smart_study_forge: { label: 'Smart Study Forge', credits: 50 },
  bench_simulator: { label: 'Bench Simulator', credits: 20 },
};

export type AiAccessReservation =
  | { route: 'system'; moduleKey: AiCreditModuleKey; transactionId: string | null; unlimited: boolean }
  | { route: 'byok'; moduleKey: AiCreditModuleKey; reason: 'credits_exhausted' };

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(
    @InjectRepository(AiPlanEntitlement)
    private readonly entitlementRepo: Repository<AiPlanEntitlement>,
    @InjectRepository(UserAiCreditBalance)
    private readonly balanceRepo: Repository<UserAiCreditBalance>,
    @InjectRepository(AiCreditTransaction)
    private readonly transactionRepo: Repository<AiCreditTransaction>,
  ) {}

  normalizeModule(moduleName?: string): AiCreditModuleKey {
    const normalized = String(moduleName || '').toLowerCase();
    if (normalized.includes('research')) return 'legal_research';
    if (normalized.includes('memorial')) return 'memorial_architect';
    if (normalized.includes('judgment')) return 'judgment_mastery';
    if (normalized.includes('studyforge') || normalized.includes('study_forge')) return 'smart_study_forge';
    if (normalized.includes('notebook')) return 'lexnotebook';
    if (normalized.includes('bench') || normalized.includes('moot')) return 'bench_simulator';
    return 'lexmentor';
  }

  async ensureFreeCredits(userId: string): Promise<UserAiCreditBalance[]> {
    if (!userId) return [];

    await this.ensureFreeEntitlements();
    const existing = await this.balanceRepo.find({ where: { userId } });
    const existingKeys = new Set(existing.map((balance) => balance.moduleKey));
    const created: UserAiCreditBalance[] = [];

    for (const [moduleKey, config] of Object.entries(FREE_PLAN_CREDITS) as Array<[AiCreditModuleKey, { label: string; credits: number }]>) {
      if (existingKeys.has(moduleKey)) continue;

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

  async getCreditSummary(userId: string) {
    const balances = await this.ensureFreeCredits(userId);
    return balances
      .sort((a, b) => this.getSortIndex(a.moduleKey) - this.getSortIndex(b.moduleKey))
      .map((balance) => ({
        moduleKey: balance.moduleKey,
        label: FREE_PLAN_CREDITS[balance.moduleKey as AiCreditModuleKey]?.label || balance.moduleKey,
        planKey: balance.planKey,
        creditsGranted: Number(balance.creditsGranted || 0),
        creditsUsed: Number(balance.creditsUsed || 0),
        creditsRemaining: Number(balance.creditsRemaining || 0),
        resetPeriod: balance.resetPeriod,
        resetAt: balance.resetAt,
      }));
  }

  async reserveForSystemProvider(userId: string | undefined, moduleName?: string): Promise<AiAccessReservation> {
    const moduleKey = this.normalizeModule(moduleName);
    if (!userId) return { route: 'system', moduleKey, transactionId: null, unlimited: false };

    // In dev mode, bypass credit limits entirely so local testing is never blocked
    if (process.env.ALLOW_DEV_AUTH_BYPASS === 'true') {
      return { route: 'system', moduleKey, transactionId: null, unlimited: true };
    }

    await this.ensureFreeCredits(userId);
    const balance = await this.balanceRepo.findOne({ where: { userId, moduleKey } });
    if (!balance) return { route: 'byok', moduleKey, reason: 'credits_exhausted' };

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

  async refundReservation(userId: string | undefined, reservation: AiAccessReservation | null, reason: string): Promise<void> {
    if (!userId || !reservation || reservation.route !== 'system' || reservation.unlimited) return;

    const balance = await this.balanceRepo.findOne({ where: { userId, moduleKey: reservation.moduleKey } });
    if (!balance) return;

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

  createLimitReachedException(moduleKey: AiCreditModuleKey) {
    const label = FREE_PLAN_CREDITS[moduleKey]?.label || 'AI';
    return new HttpException({
      code: 'AI_CREDITS_EXHAUSTED',
      message: `You have used your free ${label} credits.`,
      moduleKey,
      moduleLabel: label,
      actions: ['upgrade_plan', 'use_own_ai_provider'],
    }, HttpStatus.PAYMENT_REQUIRED);
  }

  private async ensureFreeEntitlements() {
    for (const [moduleKey, config] of Object.entries(FREE_PLAN_CREDITS) as Array<[AiCreditModuleKey, { label: string; credits: number }]>) {
      const exists = await this.entitlementRepo.findOne({ where: { planKey: 'free', moduleKey } });
      if (exists) continue;
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

  private async recordLimitReached(userId: string, moduleKey: AiCreditModuleKey) {
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

  private getSortIndex(moduleKey: string) {
    return Object.keys(FREE_PLAN_CREDITS).indexOf(moduleKey as AiCreditModuleKey);
  }
}
