import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'VoiceVault Refund Policy: our 30-day money-back guarantee and how to request a refund.',
  alternates: { canonical: '/refund-policy' },
};

export default function RefundPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
