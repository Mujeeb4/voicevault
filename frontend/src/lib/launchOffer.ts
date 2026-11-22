/**
 * Founding Family launch offer (first 100 buyers).
 *
 * The offer copy only appears when NEXT_PUBLIC_FOUNDING_OFFER=on. Turn it on together with the
 * backend setting STRIPE_PREMIUM_ONE_TIME_AMOUNT_CENTS=11900 (and no STRIPE_PREMIUM_ONE_TIME_PRICE_ID
 * pointing at the old price), so the price shown here is the price Stripe charges.
 * Turn both off after the first 100 buyers.
 */
const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const LIST_PRICE = 149.99;

export const launchOffer = {
  enabled: process.env.NEXT_PUBLIC_FOUNDING_OFFER === 'on',
  listPrice: LIST_PRICE,
  price: num(process.env.NEXT_PUBLIC_FOUNDING_PRICE, 119),
  spots: num(process.env.NEXT_PUBLIC_FOUNDING_SPOTS, 100),
};

export const money = (value: number) =>
  `$${Number.isInteger(value) ? value : value.toFixed(2)}`;

export const launchSavings = () => Math.round(launchOffer.listPrice - launchOffer.price);

