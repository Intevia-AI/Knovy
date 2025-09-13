import { AuthGuard } from '@/components/AuthGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { UserTable } from '@/components/UserTable';

function DashboardPage() {
    return (
      <DashboardLayout>
        <UserTable />
      </DashboardLayout>
    );
}

export default function Home() {
  return (
    <AuthGuard>
      <DashboardPage />
    </AuthGuard>
  );
}
