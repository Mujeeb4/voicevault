import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to your VoiceVault to record, review and share your voice with your family.',
  alternates: { canonical: '/login' },
};

export default function AuthLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
