import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { settingsFeaturesOf } from '@/features/workspaces/api/require-settings-page';
import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { wsHref } from '@/features/workspaces/lib/href';
import { settingsPagesFor } from '@/features/workspaces/lib/settings-pages';

type Props = { params: Promise<{ workspaceId: string }> };

/** The first page the caller may open — the recipe, for a content admin. */
export default async function SchoolSettingsPage({ params }: Props) {
  const { workspaceId } = await params;
  const workspace = await resolveWorkspace(workspaceId);
  const first = workspace
    ? settingsPagesFor(workspace.myRole, workspace.kind, await settingsFeaturesOf(workspace))[0]
    : undefined;
  if (!first) notFound();

  const locale = await getLocale();
  redirect(`/${locale}${wsHref(workspaceId, `settings/${first}`)}`);
}
