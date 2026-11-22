/**
 * Payments API - Stripe checkout and packages
 */
import apiClient from './client';

export interface Package {
  id?: string;
  tier: 'free' | 'premium';
  name: string;
  description?: string;
  price_cents: number;
  price_display?: string;
  features: string[];
  highlighted?: boolean;
  family_members?: number;
  questions_per_family_member?: number;
  credit_unit_price_cents?: number;
  /** Founding offer still on (false once its spots are sold) */
  founding_active?: boolean;
  founding_spots_left?: number | null;
}

interface ApiPackage {
  tier: string;
  name: string;
  price?: number;
  price_display?: string;
  features: string[];
  highlighted?: boolean;
  family_members?: number;
  questions_per_family_member?: number;
  credit_unit_price_cents?: number;
  /** Founding offer still on (false once its spots are sold) */
  founding_active?: boolean;
  founding_spots_left?: number | null;
}

/** Questions left for the signed-in family member in one vault. */
export interface QuestionCredits {
  is_premium_vault: boolean;
  can_buy_credits: boolean;
  included_questions: number;
  included_questions_used: number;
  included_questions_remaining: number;
  credit_balance: number;
  questions_remaining: number;
  credit_unit_price_cents: number;
  credit_min_purchase: number;
  credit_max_purchase: number;
  currency: string;
  /** Card saved at Stripe from an earlier purchase, used for one-click refills. */
  saved_card: { brand: string; last4: string } | null;
}

/** Result of a one-click refill; requires_checkout means the card needs the buyer (declined or bank check). */
export interface RefillResult {
  payment_completed?: boolean;
  questions?: Partial<QuestionCredits> | null; // counts only (no vault or saved-card fields)
  requires_checkout?: boolean;
  error?: string;
}

function normalizePackage(raw: ApiPackage): Package {
  const price = raw.price ?? (raw.tier === 'free' ? 0 : 149.99);
  const tier = raw.tier === 'free' ? 'free' : 'premium';
  return {
    id: tier,
    tier,
    name: raw.name,
    price_cents: price * 100,
    price_display: raw.price_display ?? `$${price}`,
    features: raw.features ?? [],
    highlighted: raw.highlighted ?? true,
    family_members: raw.family_members,
    questions_per_family_member: raw.questions_per_family_member,
    credit_unit_price_cents: raw.credit_unit_price_cents,
    founding_active: raw.founding_active,
    founding_spots_left: raw.founding_spots_left,
  };
}

export const paymentsApi = {
  getPackages: async (): Promise<{ packages: Package[] }> => {
    const { data } = await apiClient.get<{ packages?: ApiPackage[] }>('/payments/packages/');
    const raw = data.packages ?? data ?? [];
    const packages = Array.isArray(raw) ? raw.map(normalizePackage) : [];
    return { packages };
  },

  createCheckoutSession: async (): Promise<{ checkout_url: string }> => {
    const { data } = await apiClient.post('/payments/create-checkout/', {
      package_tier: 'premium',
    });
    return {
      checkout_url: data.checkout_url ?? data.url ?? '',
    };
  },

  confirmCheckoutSession: async (
    sessionId: string
  ): Promise<{
    payment_completed: boolean;
    is_premium: boolean;
    payment_status?: string;
    amount_total?: number | null;
    currency?: string | null;
  }> => {
    const { data } = await apiClient.post('/payments/confirm-checkout/', { session_id: sessionId });
    return data;
  },

  getQuestionCredits: async (aiOwnerId: string): Promise<QuestionCredits> => {
    const { data } = await apiClient.get<QuestionCredits>('/payments/credits/', {
      params: { ai_owner_id: aiOwnerId },
    });
    return data;
  },

  createCreditCheckoutSession: async (
    aiOwnerId: string,
    credits: number
  ): Promise<{ checkout_url: string }> => {
    const { data } = await apiClient.post('/payments/credits/checkout/', {
      ai_owner_id: aiOwnerId,
      credits,
    });
    return { checkout_url: data.checkout_url ?? '' };
  },

  refillWithSavedCard: async (
    aiOwnerId: string,
    credits: number,
    requestId: string
  ): Promise<RefillResult> => {
    try {
      const { data } = await apiClient.post<RefillResult>('/payments/credits/refill/', {
        ai_owner_id: aiOwnerId,
        credits,
        request_id: requestId,
      });
      return data;
    } catch (err) {
      const data = (err as { response?: { data?: RefillResult } }).response?.data;
      if (data?.requires_checkout) return data;
      throw err;
    }
  },

  removeSavedCard: async (): Promise<void> => {
    await apiClient.delete('/payments/credits/saved-card/');
  },

  /** Confirms a returning credit checkout; the webhook does the same, crediting only once. */
  confirmCreditCheckout: async (
    sessionId: string
  ): Promise<{ payment_completed: boolean; questions: QuestionCredits | null }> => {
    const { data } = await apiClient.post('/payments/confirm-checkout/', { session_id: sessionId });
    return data;
  },

  getPaymentStatus: async (): Promise<{ payment_completed: boolean }> => {
    const { data } = await apiClient.get('/payments/status/');
    return data;
  },

  getBillingDetails: async (): Promise<{
    is_paid: boolean;
    plan_name: string | null;
    amount_paid_cents: number | null;
    paid_at: string | null;
    payment_method_display: string | null;
    is_lifetime: boolean;
    receipt_url: string | null;
  }> => {
    const { data } = await apiClient.get('/payments/billing/');
    return data;
  },
};
