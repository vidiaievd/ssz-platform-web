import { getTranslations, getLocale } from 'next-intl/server';
import { Users, UserPlus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';
import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';
import { wsHref } from '@/features/workspaces/lib/href';
import { getStudents } from '@/features/students/api/queries';
import { TutorStudentRow } from '@/features/tutoring/components/tutor-student-row';
import { TutorStudentsSearch } from '@/features/tutoring/components/tutor-students-search';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function TutorRoster({ params, searchParams }: Props) {
  const { workspaceId } = await params;
  const { q } = await searchParams;
  const [t, locale] = await Promise.all([getTranslations('Tutor.students'), getLocale()]);

  const workspace = await getTutorWorkspace();
  if (!workspace) {
    return (
      <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-2 text-sm text-destructive">{t('loadFailed')}</p>
      </main>
    );
  }

  const { items: all } = await getStudents(workspace.schoolId, { search: q });
  // The roster endpoint ignores ?search, so the school screen filters in the browser;
  // here the whole list is already on the server, so filter it where it is.
  const needle = q?.trim().toLowerCase() ?? '';
  const students = needle
    ? all.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle),
      )
    : all;
  const invitationsHref = wsHref(workspaceId, 'invitations');

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {/* The count is the roster, not the search result — a filter must not read
                as though the tutor lost their students. */}
            {t('count', { count: all.length })}
            {needle && students.length !== all.length ? ` · ${t('matching', { count: students.length })}` : ''}
          </p>
        </div>

        <Button size="sm" asChild>
          <Link href={invitationsHref}>
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
            {t('invite')}
          </Link>
        </Button>
      </div>

      <TutorStudentsSearch />

      {students.length === 0 ? (
        <div className="flex flex-col items-center gap-6 py-24 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40" aria-hidden />
          <div className="space-y-1">
            <p className="text-base font-medium">{q ? t('emptyFiltered') : t('emptyTitle')}</p>
            {!q && <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>}
          </div>
          {!q && (
            <Button size="sm" asChild>
              <Link href={invitationsHref}>
                <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
                {t('invite')}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1" role="list" aria-label={t('title')}>
          {students.map((s) => (
            <div key={s.userId} role="listitem">
              <TutorStudentRow
                student={s}
                href={wsHref(workspaceId, `students/${s.userId}`)}
                lastSeenLabel={
                  s.lastSeen
                    ? formatRelative(new Date(s.lastSeen), locale as Locale)
                    : t('neverSeen')
                }
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
