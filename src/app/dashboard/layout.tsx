import { DashboardLayout } from '@/components/dashboard-layout';

interface DashboardLayoutPageProps {
  children: React.ReactNode;
}

export default function DashboardLayoutPage({ children }: DashboardLayoutPageProps) {
  return <DashboardLayout>{children}</DashboardLayout>;
}