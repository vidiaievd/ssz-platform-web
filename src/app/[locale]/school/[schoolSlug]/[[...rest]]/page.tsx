import { notFound, permanentRedirect } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string; rest?: string[] }>;
};

/**
 * Where the staff screens used to live (plan 61, phase 3).
 *
 * All of them are addressed by workspace now, so this is what is left of the old tree:
 * one redirect, for the addresses people kept — bookmarks, pasted links, links in mail
 * that went out months ago. The slug still resolves, because that is what those links
 * carry; it lands on the workspace's id, which is the address from here on.
 *
 * 308 rather than 307: the move is permanent, and worth a client remembering.
 */
export default async function SchoolWorkspaceMovedPage({ params }: Props) {
  const { locale, schoolSlug, rest } = await params;

  const workspace = await resolveWorkspace(schoolSlug);
  if (!workspace) notFound();

  const tail = rest?.length ? `/${rest.join('/')}` : '';
  permanentRedirect(`/${locale}/w/${workspace.id}${tail}`);
}
