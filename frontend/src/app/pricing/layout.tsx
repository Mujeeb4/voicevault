import type { Metadata } from 'next';
import { launchOffer } from '@/lib/launchOffer';
import { siteUrl } from '@/config/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free, then pay once to keep your voice forever. No subscription. Founding Family pricing for the first 100 families.',
  alternates: { canonical: '/pricing' },
};

const price = launchOffer.enabled ? launchOffer.price : launchOffer.listPrice;

const productData = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'VoiceVault Premium (lifetime)',
  description:
    'Record your life stories and keep your voice forever. One-time payment, no subscription.',
  url: `${siteUrl}/pricing`,
  brand: { '@type': 'Brand', name: 'VoiceVault' },
  offers: {
    '@type': 'Offer',
    url: `${siteUrl}/pricing`,
    price: String(price),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productData).replace(/</g, '\\u003c') }}
      />
      {children}
    </>
  );
}
