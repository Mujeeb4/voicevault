import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Building your voice',
  robots: { index: false, follow: false },
};

export default function UserProcessingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
