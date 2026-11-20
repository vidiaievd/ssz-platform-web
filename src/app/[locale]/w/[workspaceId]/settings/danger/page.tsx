import { getTranslations } from 'next-intl/server';

import { DeleteSchoolSection } from '@/features/school/components/settings/delete-school-section';
import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Settings.danger');
  return { title: `${t('title')} · ${workspaceId}` };
}

/**
 * The owner's way to delete a school (plan 90, block 9, step 5). Reached only by the owner of
 * a SCHOOL workspace; the same move as the administrator's "Close", just without the journal.
 */
export default async function SchoolDangerSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  const workspace = await requireSettingsPage(workspaceId, 'danger');
  const t = await getTranslations('Settings.danger');

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 p-6 md:p-8">
      <div>
        <div className="mb-[5px] text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {t('eyebrow')}
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">{t('title')}</h1>
      </div>

      <DeleteSchoolSection schoolId={workspace.id} schoolName={workspace.name} />
    </div>
  );
}
