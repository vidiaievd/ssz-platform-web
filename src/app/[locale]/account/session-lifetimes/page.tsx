import { SessionLifetimesScreen } from '@/features/account';
import { requireRole } from '@/lib/auth/protect';

export default async function SessionLifetimesPage() {
  // A platform setting, not a personal one: other roles get a 404, not a disabled form.
  await requireRole('platform_admin');
  return <SessionLifetimesScreen />;
}
