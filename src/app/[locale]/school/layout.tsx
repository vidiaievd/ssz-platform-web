import { requireAnyRole } from '@/lib/auth/protect';
import { AppShell } from '@/components/shared/app-shell';

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAnyRole(['school', 'tutor']);
  return (
    <AppShell variant="school" user={user}>
      {children}
    </AppShell>
  );
}
