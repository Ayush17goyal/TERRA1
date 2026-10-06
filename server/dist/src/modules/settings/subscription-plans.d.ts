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
export declare const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlanDefinition>;
export declare function normalizeSubscriptionPlan(value?: string | null): SubscriptionPlanId;
export declare function getPaidPlan(planId: string): SubscriptionPlanDefinition | null;
