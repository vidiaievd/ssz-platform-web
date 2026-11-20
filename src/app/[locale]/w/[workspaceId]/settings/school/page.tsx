import { getTranslations } from 'next-intl/server';

import { isWorkspaceWritable } from '@/features/school-lifecycle/api/get-workspace-lifecycle';
import { SchoolProfileForm } from '@/features/school/components/settings/school-profile-form';
import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Settings.school');
  return { title: `${t('title')} · ${workspaceId}` };
}

/**
 * The school's own card (plan 90 §8, step 11): logo, name, description and contacts — what the
 * public school page and the catalogue show. Owner and administrators; read only while the
 * school is suspended or closed.
 */
export default async function SchoolProfilePage({ params }: Props) {
  const { workspaceId } = await params;
  const workspace = await requireSettingsPage(workspaceId, 'school');
  const writable = await isWorkspaceWritable(workspaceId);
  const t = await getTranslations('Settings.school');

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 p-6 md:p-8">
      <div>
        <div className="mb-[5px] text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {t('eyebrow')}
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t('lede')}</p>
      </div>

      <SchoolProfileForm schoolId={workspace.id} canEdit={writable} />
    </div>
  );
}
