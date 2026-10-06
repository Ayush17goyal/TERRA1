export type PricingFeature = {
  name: string
  limit?: string
  tooltip: string
}

export type PricingPlan = {
  id: 'free' | 'starter' | 'pro' | 'pro-max'
  name: string
  price: number
  billing: string
  period: string
  tag: string
  description: string
  badge?: string
  featured?: boolean
  premium?: boolean
  cta: string
  features: PricingFeature[]
  restrictions?: PricingFeature[]
}

/**
 * The public pricing catalogue. PricingPage, checkout, and CTA labels all read
 * from this single structure so visible prices cannot drift from checkout data.
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    billing: 'Forever',
    period: 'Forever',
    tag: 'Explore LEGATRIXON',
    description: 'For users exploring the core LEGATRIXON experience.',
    cta: 'Get Started',
    features: [
      { name: 'LexMentor AI', limit: 'Free', tooltip: 'Ask grounded legal questions with LexMentor AI.' },
      { name: 'Bare Act AI', limit: 'Free', tooltip: 'Explore and understand Bare Act provisions.' },
      { name: 'Bare Act Drafting Mentor', limit: 'Up to 5 uses/day', tooltip: 'Up to 5 uses/day. Upgrade to Premium for more.' },
      { name: 'Calendar', limit: 'Free', tooltip: 'Plan classes, deadlines, and study commitments.' },
      { name: 'Career Track', limit: 'Free', tooltip: 'Use the legal career planning track.' },
    ],
    restrictions: [
      { name: 'Case Law Reasoning', limit: '2 free samples', tooltip: '1-2 free samples, then upgrade.' },
      { name: 'Mock Tests', limit: '1 free trial', tooltip: '1 free trial, then upgrade.' },
      { name: 'Legal Research', limit: '1 free trial', tooltip: '1 free trial, then upgrade.' },
      { name: 'Drafting Academy', limit: 'Paid feature', tooltip: 'Upgrade to unlock the Drafting Academy.' },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 199,
    billing: 'per month',
    period: '/month',
    tag: 'Regular AI Assistance',
    description: 'For students who need regular AI assistance.',
    cta: 'Choose Starter',
    features: [
      { name: 'AI Home Page', tooltip: 'Access the LEGATRIXON AI home experience.' },
      { name: 'Calendar', tooltip: 'Plan classes, deadlines, and study commitments.' },
      { name: 'Bare Act AI', tooltip: 'Explore and understand Bare Act provisions.' },
      { name: 'Case Law Reasoning', limit: '5 cases/day', tooltip: 'Analyze up to 5 cases per day.' },
      { name: 'Mock Tests', limit: '2 trials', tooltip: 'Generate 2 mock tests in each billing cycle.' },
      { name: 'Legal Research', limit: '2 trials', tooltip: 'Run 2 legal research reports in each billing cycle.' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 399,
    billing: 'per month',
    period: '/month',
    tag: 'Serious Legal Study',
    description: 'For serious law students and researchers.',
    badge: 'Recommended',
    featured: true,
    cta: 'Upgrade to Pro',
    features: [
      { name: 'AI Home Page', tooltip: 'Access the LEGATRIXON AI home experience.' },
      { name: 'Calendar', tooltip: 'Plan classes, deadlines, and study commitments.' },
      { name: 'Bare Act AI', tooltip: 'Explore and understand Bare Act provisions.' },
      { name: 'Case Law Reasoning', tooltip: 'Use the full Pro case-law reasoning entitlement.' },
      { name: 'Mock Tests', limit: '5 trials', tooltip: 'Generate 5 mock tests in each billing cycle.' },
      { name: 'Legal Research', limit: '5 trials', tooltip: 'Run 5 legal research reports in each billing cycle.' },
    ],
  },
  {
    id: 'pro-max',
    name: 'Pro Max',
    price: 599,
    billing: 'per month',
    period: '/month',
    tag: 'Maximum Research Power',
    description: 'For intensive legal research and preparation.',
    badge: 'Premium',
    premium: true,
    cta: 'Upgrade to Pro Max',
    features: [
      { name: 'AI Home Page', tooltip: 'Access the LEGATRIXON AI home experience.' },
      { name: 'Calendar', tooltip: 'Plan classes, deadlines, and study commitments.' },
      { name: 'Bare Act AI', tooltip: 'Explore and understand Bare Act provisions.' },
      { name: 'Case Law Reasoning', tooltip: 'Use the full Pro Max case-law reasoning entitlement.' },
      { name: 'Mock Tests', limit: '10 trials', tooltip: 'Generate 10 mock tests in each billing cycle.' },
      { name: 'Legal Research', limit: '10 trials', tooltip: 'Run 10 legal research reports in each billing cycle.' },
    ],
  },
]

export const normalizePlanId = (value?: string | null): PricingPlan['id'] => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'starter' || normalized === 'basic plan' || normalized === 'basic') return 'starter'
  if (normalized === 'pro' || normalized === 'pro plan' || normalized === 'juris') return 'pro'
  if (normalized === 'pro-max' || normalized === 'pro max' || normalized === 'pro max plan' || normalized === 'lexmaster') return 'pro-max'
  return 'free'
}
