'use client';

import { DashboardLayout } from '@/components/layout';

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
