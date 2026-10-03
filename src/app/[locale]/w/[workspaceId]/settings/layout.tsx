import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { UnsavedChangesProvider } from '@/features/account/components/unsaved-changes-provider';
import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { wsHref } from '@/features/workspaces/lib/href';
import { settingsPagesFor } from '@/features/workspaces/lib/settings-pages';

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

export default async function SchoolSettingsLayout({ children, params }: Props) {
  const { workspaceId } = await params;

  const workspace = await resolveWorkspace(workspaceId);
  const pages = workspace ? settingsPagesFor(workspace.myRole, workspace.kind) : [];
  if (pages.length === 0) notFound();

  const t = await getTranslations('Settings');

  const nav = pages.map((page) => ({
    href: wsHref(workspaceId, `settings/${page}`),
    label: t(`nav.${page}`),
    ...(page === 'recipe'
      ? {
          badge: (
            <span className="text-[10px] font-bold tracking-[0.06em] text-(--ssz-color-primary-700) uppercase">
              {t('nav.new')}
            </span>
          ),
        }
      : {}),
  }));

  // The recipe page holds a draft; the provider asks before the settings nav or a reload
  // drops it.
  return (
    <UnsavedChangesProvider>
      <SettingsLayout nav={nav}>{children}</SettingsLayout>
    </UnsavedChangesProvider>
  );
}
