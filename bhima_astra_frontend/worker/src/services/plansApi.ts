// Worker Plans API Service with Fallback
// Fetches real plans data from API, falls back to mock values on errors

import { getToken } from './api';

const BASE_URL =
  ((import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL as string) || 'http://localhost:8000';

// ── Helper: Build auth headers ────────────────────────────────────────────
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
});

// ── Types ─────────────────────────────────────────────────────────────────

export interface PlanTier {
  tier: string;
  weekly_premium: number;
  base_premium: number;
  city_multiplier: number;
  payout_l1: number;
  payout_l2: number;
  payout_l3: number;
  max_events: number;
}

export interface Plan {
  key: string;
  name: string;
  price: string;
  tagline: string;
  badge: string | null;
  meta: {
    weeklyPremium: string;
    perEventPayout: string;
    maxEventsPerWeek: string;
  };
  features: string[];
  cta: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface PlanComparison {
  city: string;
  city_tier: number;
  tier_label: string;
  multiplier: number;
  plans: PlanTier[];
}

// ── Utility Functions ────────────────────────────────────────────────────

const formatINR = (amount: number): string => {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
};

// ── Fallback Mock Data ────────────────────────────────────────────────────

export const FALLBACK_PLANS: Plan[] = [
  {
    key: 'basic',
    name: 'Basic',
    price: formatINR(49),
    tagline: 'Essential parametric cover for part-time & low-income workers.',
    badge: null,
    meta: {
      weeklyPremium: formatINR(49),
      perEventPayout: formatINR(300),
      maxEventsPerWeek: '2 events',
    },
    features: [
      'Coverage: Rainfall, Heat, AQI',
      'Instant payouts (2-4 hours)',
      'No claim form needed',
      'Mobile-first platform',
    ],
    cta: 'Start Basic',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: formatINR(99),
    tagline: 'Full coverage with higher payouts for serious gig workers.',
    badge: 'Most Popular',
    meta: {
      weeklyPremium: formatINR(99),
      perEventPayout: formatINR(750),
      maxEventsPerWeek: '5 events',
    },
    features: [
      'All Basic + Curfew, Strikes',
      'Higher per-event payouts',
      '24/7 priority support',
      'Real-time notifications',
      'Multi-trigger coverage',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    key: 'elite',
    name: 'Elite',
    price: formatINR(199),
    tagline: 'Premium protection for full-time delivery & logistics workers.',
    badge: 'Best Value',
    meta: {
      weeklyPremium: formatINR(199),
      perEventPayout: formatINR(1500),
      maxEventsPerWeek: 'Unlimited',
    },
    features: [
      'All Pro + Custom zones',
      'Unlimited monthly payouts',
      '24/7 dedicated support',
      'Accident & injury coverage',
      'Premium priority queue',
    ],
    cta: 'Upgrade to Elite',
  },
];

export const FALLBACK_FAQS: FAQ[] = [
  {
    question: 'When is a payout triggered?',
    answer:
      'Payouts are automatically triggered when our independent weather or event data sources confirm a qualifying hazard in your active zone. No manual claim is required.',
  },
  {
    question: 'How fast do I receive payout?',
    answer:
      'Once a trigger is confirmed, payouts are processed instantly and usually reflect in your linked bank account or UPI within 2-4 hours.',
  },
  {
    question: 'Can I switch plans anytime?',
    answer:
      'Yes! You can upgrade or downgrade your plan anytime. Changes take effect from the next billing cycle.',
  },
  {
    question: 'What if I need to pause coverage?',
    answer:
      'You can pause your coverage temporarily without losing your activation. Resume anytime within 30 days.',
  },
  {
    question: 'Do I need to provide proof of loss?',
    answer:
      'No! BHIMA ASTRA uses parametric insurance — payouts trigger automatically based on event data, not individual claims.',
  },
  {
    question: 'What zones are covered?',
    answer:
      'We currently cover major metros: Mumbai, Delhi, Bangalore, Hyderabad, Pune, Chennai, and expanding cities. Your zone is automatically detected.',
  },
];

// ── Public API Functions ──────────────────────────────────────────────────

/**
 * Fetch available plans from API with fallback to mock data
 */
export const fetchPlans = async (city?: string): Promise<Plan[]> => {
  try {
    const url = city
      ? `${BASE_URL}/api/v1/policies/plans?city=${encodeURIComponent(city)}`
      : `${BASE_URL}/api/v1/policies/plans`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_PLANS;
  } catch (err) {
    console.warn(
      'Failed to fetch plans, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_PLANS;
  }
};

/**
 * Fetch plan FAQs from API with fallback to mock data
 */
export const fetchPlanFAQs = async (): Promise<FAQ[]> => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/policies/faqs`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_FAQS;
  } catch (err) {
    console.warn(
      'Failed to fetch plan FAQs, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_FAQS;
  }
};

/**
 * Fetch plan comparison data from API with fallback
 */
export const fetchPlanComparison = async (
  city: string = 'Mumbai',
): Promise<PlanComparison | null> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/policies/plans/compare?city=${encodeURIComponent(city)}`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data || null;
  } catch (err) {
    console.warn(
      'Failed to fetch plan comparison, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return null;
  }
};

/**
 * Fetch detailed plan tiers from API with fallback
 */
export const fetchPlanTiers = async (city?: string): Promise<PlanTier[]> => {
  try {
    const url = city
      ? `${BASE_URL}/api/v1/policies/tiers?city=${encodeURIComponent(city)}`
      : `${BASE_URL}/api/v1/policies/tiers`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn(
      'Failed to fetch plan tiers, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return [];
  }
};

/**
 * Fetch all plans page data in parallel with fallbacks
 */
export const fetchPlansPageData = async (city?: string) => {
  const [plans, faqs, comparison] = await Promise.all([
    fetchPlans(city),
    fetchPlanFAQs(),
    fetchPlanComparison(city),
  ]);

  return {
    plans,
    faqs,
    comparison,
  };
};
