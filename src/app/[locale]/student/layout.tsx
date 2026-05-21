import { requireRole } from '@/lib/auth/protect';
import { AppShell } from '@/components/shared/app-shell';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('student');
  return (
    <AppShell variant="student" user={user}>
      {children}
    </AppShell>
  );
}
