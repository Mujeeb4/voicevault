import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
};

export default function UserChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
