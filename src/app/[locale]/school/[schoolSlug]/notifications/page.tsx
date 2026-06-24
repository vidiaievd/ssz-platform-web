import { Suspense } from 'react';

import { NotificationsPage } from '@/features/notifications/components/notifications-page';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function SchoolNotificationsPage({ params }: Props) {
  const { schoolSlug, locale } = await params;

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-215 mx-auto mt-6" />}>
      <NotificationsPage
        linkContext={{ workspaceKind: 'school', schoolSlug }}
        locale={locale}
      />
    </Suspense>
  );
}
