'use client';

import { useEffect, useState } from 'react';
import { paymentsApi } from '@/lib/api/payments';
import { launchOffer } from '@/lib/launchOffer';

let offerStatus: Promise<boolean> | null = null;

/**
 * Whether to show the Founding offer: the build-time flag, turned off as soon as the pricing
 * API reports the spots are sold out, so the page never advertises a price checkout won't charge.
 */
export function useFoundingOfferActive(): boolean {
  const [active, setActive] = useState(launchOffer.enabled);
  useEffect(() => {
    if (!launchOffer.enabled) return;
    let mounted = true;
    offerStatus ??= paymentsApi
      .getPackages()
      .then((response) => response.packages.find((p) => p.tier === 'premium')?.founding_active !== false)
      .catch(() => true);
    offerStatus.then((value) => { if (mounted) setActive(value); });
    return () => { mounted = false; };
  }, []);
  return launchOffer.enabled && active;
}
