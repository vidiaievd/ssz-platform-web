import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getStudents, getGroupsForSelect } from '@/features/students/api/queries';
import { StudentsRosterClient } from '@/features/students/components/students-roster-client';
import { EnrollShell } from '@/features/students/components/enroll-shell';
import { getPendingCount } from '@/features/invitations/api/queries';
import { PendingInvitesLink } from '@/features/invitations/components/pending-invites-link';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
  searchParams: Promise<{ q?: string; segment?: string }>;
};

export default async function SchoolStudentsPage({ params, searchParams }: Props) {
  const { schoolSlug } = await params;
  const { q } = await searchParams;
  const t = await getTranslations('Students');

  const school = await getSchoolBySlug(schoolSlug);

  if (!school) {
    return (
      <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto">
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      </main>
    );
  }

  const [studentsResult, pendingInvitesCount, groups] = await Promise.all([
    getStudents(school.id, { search: q }),
    getPendingCount(school.id, 'students').catch((err) => {
      console.error('[students/page] getPendingCount failed:', err);
      return null;
    }),
    getGroupsForSelect(school.id),
  ]);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-6">
      {/* Pending invites indicator */}
      {pendingInvitesCount === null ? (
        <p className="text-sm text-destructive">Failed to load pending invitations count.</p>
      ) : pendingInvitesCount > 0 ? (
        <PendingInvitesLink
          count={pendingInvitesCount}
          href={`/school/${schoolSlug}/invitations?audience=students`}
        />
      ) : null}

      {/* Enroll dialog — URL-driven (?enroll=1) */}
      <Suspense>
        <EnrollShell schoolId={school.id} groups={groups} />
      </Suspense>

      <StudentsRosterClient schoolId={school.id} schoolSlug={schoolSlug} initial={studentsResult} />
    </main>
  );
}
