import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default function UserSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
