import { AuthGuard } from "@/components/AuthGuard";
import { DashboardLayout } from "@/components/DashboardLayout";
import { WaitlistTable } from "@/components/WaitlistTable";

function WaitlistPage() {
  return (
    <DashboardLayout>
      <WaitlistTable />
    </DashboardLayout>
  );
}

export default function Waitlist() {
  return (
    <AuthGuard>
      <WaitlistPage />
    </AuthGuard>
  );
}
