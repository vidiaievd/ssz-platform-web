import { getTranslations } from 'next-intl/server';

import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';
import { AiPrecheckSettingsForm } from '@/features/school/components/settings/ai-precheck-settings';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Settings.precheck');
  return { title: `${t('title')} · ${workspaceId}` };
}

/**
 * Whether the school's learners may have a model check their work before handing it in, and
 * how often (plan 84, step 9).
 *
 * Reached only by an owner or an administrator of a workspace whose plan carries
 * `ai.practice`; organization-service refuses turning it on without the key as well.
 */
export default async function SchoolPrecheckSettingsPage({ params }: Props) {
  const { workspaceId } = await params;

  const workspace = await requireSettingsPage(workspaceId, 'precheck');
  const t = await getTranslations('Settings.precheck');

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 p-6 md:p-8">
      <div>
        <div className="mb-[5px] text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {t('eyebrow')}
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">{t('heading')}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t('lede')}</p>
      </div>

      <AiPrecheckSettingsForm
        school={workspace.id}
        canEdit={workspace.myRole === 'OWNER' || workspace.myRole === 'ADMIN'}
      />
    </div>
  );
}
