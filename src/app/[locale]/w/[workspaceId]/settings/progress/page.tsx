import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { StudentPositionSetting } from '@/features/school/components/settings/student-position-setting';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Settings.progress');
  return { title: `${t('title')} · ${workspaceId}` };
}

/**
 * What this school's learners are told about their own progress.
 *
 * One decision today — the group position sentence of screen F. Its own section rather
 * than a line on the review settings, because it belongs to a different reader: this is
 * about what students see, not about what the school promises its reviewers.
 */
export default async function SchoolProgressSettingsPage({ params }: Props) {
  const { workspaceId } = await params;

  const role = await getMySchoolRole(workspaceId);
  if (role === null) notFound();

  const t = await getTranslations('Settings.progress');

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 p-6 md:p-8">
      <div>
        <div className="mb-[5px] text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {t('eyebrow')}
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t('lede')}</p>
      </div>

      <StudentPositionSetting
        schoolId={workspaceId}
        canEdit={role === 'OWNER' || role === 'ADMIN'}
      />
    </div>
  );
}
