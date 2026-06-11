import { Suspense } from 'react';
import { MailCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getInvitations, getPendingCount } from '@/features/invitations/api/queries';
import { InvitationsTabs } from '@/features/invitations/components/invitations-tabs';
import { InvitationsTable } from '@/features/invitations/components/invitations-table';
import type { InvitationAudience } from '@/features/invitations/types';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ audience?: string }>;
};

export default async function InvitationsPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { audience: audienceRaw } = await searchParams;
  const t = await getTranslations('Invitations.page');

  const audience: InvitationAudience =
    audienceRaw === 'teachers' ||
    audienceRaw === 'students' ||
    audienceRaw === 'staff'
      ? audienceRaw
      : 'all';

  const school = await getSchoolBySlug(schoolSlug);

  if (!school) {
    return (
      <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground">School not found.</p>
      </main>
    );
  }

  const [allInvitations, pendingCount, expiredCount] = await Promise.all([
    getInvitations(school.id).catch((): Awaited<ReturnType<typeof getInvitations>> => []),
    getPendingCount(school.id, 'all').catch(() => 0),
    getInvitations(school.id, { status: 'expired' }).then((items) => items.length).catch(() => 0),
  ]);

  const filtered =
    audience === 'all'
      ? allInvitations
      : allInvitations.filter((inv) => {
          if (audience === 'teachers') return inv.role === 'TEACHER';
          if (audience === 'students') return inv.role === 'STUDENT';
          if (audience === 'staff') {
            return (
              inv.role === 'ADMIN' || inv.role === 'CONTENT_ADMIN' || inv.role === 'SCHEDULER'
            );
          }
          return true;
        });

  const subtitle =
    pendingCount > 0
      ? t('pendingSummary', { count: pendingCount }) +
        (expiredCount > 0 ? ' · ' + t('expiredSummary', { count: expiredCount }) : '')
      : t('noPending');

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-semibold">{t('title')}</h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <Suspense>
        <InvitationsTabs invitations={allInvitations} />
      </Suspense>

      {/* Table */}
      <InvitationsTable
        key={audience}
        invitations={filtered}
        schoolId={school.id}
      />
    </main>
  );
}
