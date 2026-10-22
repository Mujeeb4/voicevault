import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset your password',
  description:
    'Enter your email and we will send you a link to reset your VoiceVault password.',
  robots: { index: false, follow: false },
};

export default function AuthForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
