import { notFound } from 'next/navigation';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';

type Props = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

/**
 * The screens only a school has.
 *
 * The dashboard, groups, teachers, timetables, enrolment queues and the staff invitation
 * tract are shaped around a school with people in roles — the dashboard literally offers
 * to "get your school running". A private tutor's workspace has none of
 * that, and its shell offers none of it — but a shared address space means the URLs exist
 * for them too, and a tutor who typed one got a screen full of the word "school", which
 * plan 59 forbids outright.
 *
 * A route group, so the guard costs one file and no path segment: for a solo workspace
 * these screens do not exist, which is the same answer the shell gives by not listing
 * them.
 */
export default async function SchoolOnlyLayout({ children, params }: Props) {
  const { workspaceId } = await params;

  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace || workspace.kind === 'SOLO') notFound();

  return <>{children}</>;
}
