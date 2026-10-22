import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create your free account',
  description:
    'Start free. Record your first answers and decide later whether to unlock your full voice.',
  alternates: { canonical: '/signup' },
};

export default function AuthSignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
