import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Choose a new password for your VoiceVault account.',
  robots: { index: false, follow: false },
};

export default function AuthResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
