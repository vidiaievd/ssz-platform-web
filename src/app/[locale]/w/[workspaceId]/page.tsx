import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { WORKSPACE_DEFAULT_SEGMENT } from '@/lib/navigation/workspace-defaults';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = {
  params: Promise<{ workspaceId: string }>;
};

/** A workspace opens on the first screen it has. Which screen that is depends on its kind. */
export default async function WorkspaceIndexPage({ params }: Props) {
  const { workspaceId } = await params;
  const locale = await getLocale();

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  // A tutor has no school dashboard — it offers to get a school running — and their own
  // still lives in the tutor tree until it moves here too (plan 61, phase 4).
  if (workspace.kind === 'SOLO') {
    const user = await getCurrentUser();
    redirect(`/${locale}/tutor/${user?.userId ?? ''}/dashboard`);
  }

  redirect(`/${locale}${wsHref(workspaceId, WORKSPACE_DEFAULT_SEGMENT)}`);
}
