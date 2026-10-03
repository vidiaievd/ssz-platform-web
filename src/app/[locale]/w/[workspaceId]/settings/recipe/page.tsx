import { getTranslations } from 'next-intl/server';

import { WorkspaceRecipeSettings } from '@/features/content-authoring/components/workspace-recipe/workspace-recipe-settings';
import { requireSettingsPage } from '@/features/workspaces/api/require-settings-page';
import { canEditRecipe } from '@/features/workspaces/lib/settings-pages';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations('Settings.recipe');
  return { title: t('title') };
}

/**
 * What every lesson in this workspace is expected to train — plan 65.
 *
 * The header is drawn here, on the server, so that it is already real while the recipe
 * loads. content-service refuses a write from anyone but an owner or a content admin; the
 * page reads the same rule from the role to start an administrator read-only.
 */
export default async function WorkspaceRecipeSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  const workspace = await requireSettingsPage(workspaceId, 'recipe');
  const kind = workspace.kind === 'SOLO' ? 'solo' : 'school';

  const t = await getTranslations('Settings.recipe');

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-5 p-6 md:p-8">
      <div>
        <div className="text-[13px] font-bold tracking-[0.08em] text-(--ssz-text-muted) [font-variant-caps:all-small-caps]">
          {t('eyebrow')}
        </div>
        <h1 className="mt-0.5 mb-2 text-2xl leading-[1.25] font-bold tracking-[-0.02em]">
          {t('title')}
        </h1>
        <div className="flex max-w-[68ch] flex-col gap-2 text-sm leading-normal text-(--ssz-text-secondary)">
          <p>{t('lead1', { kind })}</p>
          <p>
            {t.rich('lead2', {
              dot: () => (
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full bg-(--ssz-color-warning-500) align-middle"
                />
              ),
            })}
          </p>
        </div>
      </div>

      <WorkspaceRecipeSettings
        schoolId={workspace.id}
        canEdit={canEditRecipe(workspace.myRole)}
        kind={kind}
      />
    </div>
  );
}
