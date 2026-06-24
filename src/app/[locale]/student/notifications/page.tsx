import { Suspense } from 'react';

import { NotificationsPage } from '@/features/notifications/components/notifications-page';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function StudentNotificationsPage({ params }: Props) {
  const { locale } = await params;

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-215 mx-auto mt-6" />}>
      <NotificationsPage linkContext={{ workspaceKind: 'student' }} locale={locale} />
    </Suspense>
  );
}
