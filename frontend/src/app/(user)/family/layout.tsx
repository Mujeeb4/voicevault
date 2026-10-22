import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Family',
  robots: { index: false, follow: false },
};

export default function UserFamilyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
