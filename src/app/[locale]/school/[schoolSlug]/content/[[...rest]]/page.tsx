import { notFound, permanentRedirect } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string; rest?: string[] }>;
};

/**
 * Where the authoring screens used to live (plan 61, phase 2).
 *
 * They are addressed by workspace now, so a school's course editor and a tutor's are one
 * screen at one address. This is the whole of the old subtree: every link inside the app
 * already points at the new address, and what still arrives here is what people kept —
 * bookmarks, pasted links, a browser's history. 308 rather than 307, because the move is
 * permanent and worth caching.
 */
export default async function ContentMovedPage({ params }: Props) {
  const { locale, schoolSlug, rest } = await params;

  const workspace = await resolveWorkspace(schoolSlug);
  if (!workspace) notFound();

  const tail = rest?.length ? `/${rest.join('/')}` : '';
  permanentRedirect(`/${locale}/w/${workspace.id}/content${tail}`);
}
