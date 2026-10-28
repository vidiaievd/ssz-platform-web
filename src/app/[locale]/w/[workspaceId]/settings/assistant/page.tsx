import { getTranslations } from 'next-intl/server';

import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';
import { getAssistantAccessChoices } from '@/features/school/api/get-assistant-access-choices';
import { AssistantAccessSettings } from '@/features/school/components/settings/assistant-access-settings';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Settings.assistant');
  return { title: `${t('title')} · ${workspaceId}` };
}

/**
 * Which students the school's assistant answers on the school's account (plan 83, step 3c).
 *
 * Reached only by an owner or an administrator of a workspace whose plan carries
 * `ai.student_assist` — the read itself names students one by one, and organization-service
 * refuses anyone else on both the read and the write.
 */
export default async function SchoolAssistantSettingsPage({ params }: Props) {
  const { workspaceId } = await params;

  const workspace = await requireSettingsPage(workspaceId, 'assistant');
  const choices = await getAssistantAccessChoices(workspace.id);

  const t = await getTranslations('Settings.assistant');

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 p-6 md:p-8">
      <div>
        <div className="mb-[5px] text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {t('eyebrow')}
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">{t('heading')}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t('lede')}</p>
      </div>

      <AssistantAccessSettings
        school={workspace.id}
        choices={choices}
        canEdit={workspace.myRole === 'OWNER' || workspace.myRole === 'ADMIN'}
      />
    </div>
  );
}
