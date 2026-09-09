import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft, AlertCircle } from 'lucide-react';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getTeacherSchedule } from '@/features/groups/api/queries';
import { MyScheduleView } from '@/features/groups/components/my-schedule-view';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export default async function MySchedulePage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Groups.mySchedule');

  const [school, user] = await Promise.all([getSchoolBySlug(schoolSlug), getCurrentUser()]);
  if (!school || !user?.userId) notFound();

  const result = await getTeacherSchedule(school.id, user.userId);

  return (
    <main className="p-4 sm:p-6 lg:p-8 max-w-page mx-auto space-y-5">
      <div>
        <Link
          href={`/school/${schoolSlug}/dashboard`}
          className="inline-flex items-center gap-1 text-sm text-(--ssz-text-secondary) hover:text-(--ssz-text-primary) transition-colors mb-3"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-0.5 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      {'error' in result ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('loadFailed')}</p>
        </div>
      ) : result.data ? (
        <MyScheduleView teacher={result.data} schoolSlug={schoolSlug} />
      ) : (
        <div className="flex items-center justify-center py-20 text-center">
          <p className="text-sm text-(--ssz-text-muted)">{t('noSchedule')}</p>
        </div>
      )}
    </main>
  );
}
