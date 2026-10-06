"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_PLANS = void 0;
exports.normalizeSubscriptionPlan = normalizeSubscriptionPlan;
exports.getPaidPlan = getPaidPlan;
exports.SUBSCRIPTION_PLANS = {
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
function normalizeSubscriptionPlan(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['starter', 'basic plan', 'basic'].includes(normalized))
        return 'starter';
    if (['pro', 'pro plan', 'juris'].includes(normalized))
        return 'pro';
    if (['pro-max', 'pro max', 'pro max plan', 'lexmaster'].includes(normalized))
        return 'pro-max';
    return 'free';
}
function getPaidPlan(planId) {
    const normalized = normalizeSubscriptionPlan(planId);
    return normalized === 'free' ? null : exports.SUBSCRIPTION_PLANS[normalized];
}
//# sourceMappingURL=subscription-plans.js.map