import { notFound } from 'next/navigation';

import { NotificationsScreen } from '@/features/account/components/notifications-screen';
import { NOTIFICATIONS_ENABLED } from '@/lib/config/feature-flags';

export default function AccountNotificationsPage() {
  if (!NOTIFICATIONS_ENABLED) notFound();
  return <NotificationsScreen />;
}
