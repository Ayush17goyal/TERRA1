export type SubscriptionPlanId = 'free' | 'starter' | 'pro' | 'pro-max';
export type LimitedFeature = 'drafting_mentor' | 'case_law_reasoning' | 'mock_test' | 'legal_research' | 'drafting_academy';
export type DemoFeature = LimitedFeature | 'lexmentor_ai' | 'guidebot_ai' | 'voice_ai' | 'bare_act_ai' | 'document_processing' | 'judgment_ai' | 'draft_analysis' | 'academic_ai' | 'memorial_ai';
export type ResetPeriod = 'daily' | 'billing_cycle' | 'lifetime';

export type FeatureEntitlement = {
  limit: number | null;
  reset: ResetPeriod;
};

export type SubscriptionPlanDefinition = {
  id: SubscriptionPlanId;
  name: string;
  price: number;
  aiCredits: number;
  entitlements: Record<LimitedFeature, FeatureEntitlement>;
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlanDefinition> = {
  free: {
    id: 'free', name: 'Free', price: 0, aiCredits: 1000,
    entitlements: {
      drafting_mentor: { limit: 5, reset: 'daily' },
      case_law_reasoning: { limit: 2, reset: 'lifetime' },
      mock_test: { limit: 1, reset: 'lifetime' },
      legal_research: { limit: 1, reset: 'lifetime' },
      drafting_academy: { limit: 0, reset: 'lifetime' },
    },
  },
  starter: {
    id: 'starter', name: 'Starter', price: 199, aiCredits: 2000,
    entitlements: {
      drafting_mentor: { limit: null, reset: 'billing_cycle' },
      case_law_reasoning: { limit: 5, reset: 'daily' },
      mock_test: { limit: 2, reset: 'billing_cycle' },
      legal_research: { limit: 2, reset: 'billing_cycle' },
      drafting_academy: { limit: null, reset: 'billing_cycle' },
    },
  },
  pro: {
    id: 'pro', name: 'Pro', price: 399, aiCredits: 5000,
    entitlements: {
      drafting_mentor: { limit: null, reset: 'billing_cycle' },
      case_law_reasoning: { limit: null, reset: 'billing_cycle' },
      mock_test: { limit: 5, reset: 'billing_cycle' },
      legal_research: { limit: 5, reset: 'billing_cycle' },
      drafting_academy: { limit: null, reset: 'billing_cycle' },
    },
  },
  'pro-max': {
    id: 'pro-max', name: 'Pro Max', price: 599, aiCredits: 15000,
    entitlements: {
      drafting_mentor: { limit: null, reset: 'billing_cycle' },
      case_law_reasoning: { limit: null, reset: 'billing_cycle' },
      mock_test: { limit: 10, reset: 'billing_cycle' },
      legal_research: { limit: 10, reset: 'billing_cycle' },
      drafting_academy: { limit: null, reset: 'billing_cycle' },
    },
  },
};

export function normalizeSubscriptionPlan(value?: string | null): SubscriptionPlanId {
  const normalized = String(value || '').trim().toLowerCase();
  if (['starter', 'basic plan', 'basic'].includes(normalized)) return 'starter';
  if (['pro', 'pro plan', 'juris'].includes(normalized)) return 'pro';
  if (['pro-max', 'pro max', 'pro max plan', 'lexmaster'].includes(normalized)) return 'pro-max';
  return 'free';
}

export function getPaidPlan(planId: string): SubscriptionPlanDefinition | null {
  const normalized = normalizeSubscriptionPlan(planId);
  return normalized === 'free' ? null : SUBSCRIPTION_PLANS[normalized];
}
