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
}

interface ApiPackage {
  tier: string;
  name: string;
  price?: number;
  price_display?: string;
  features: string[];
  highlighted?: boolean;
}

function normalizePackage(raw: ApiPackage): Package {
  const price = raw.price ?? 99;
  const tier = raw.tier === 'free' ? 'free' : 'premium';
  return {
    id: tier,
    tier,
    name: raw.name,
    price_cents: price * 100,
    price_display: raw.price_display ?? `$${price}`,
    features: raw.features ?? [],
    highlighted: raw.highlighted ?? true,
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
    const { data } = await apiClient.post('/payments/create-checkout/', { package_tier: 'premium' });
    return {
      checkout_url: data.checkout_url ?? data.url ?? '',
    };
  },

  confirmCheckoutSession: async (
    sessionId: string
  ): Promise<{ payment_completed: boolean; is_premium: boolean; payment_status?: string }> => {
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
