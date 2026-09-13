import { notFound, permanentRedirect } from 'next/navigation';

import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';

type Props = {
  params: Promise<{ locale: string; userId: string; rest?: string[] }>;
};

/**
 * Where a tutor's screens used to live (plan 61, phase 4).
 *
 * They were addressed by the tutor rather than by their workspace, which made every screen
 * they share with a school a second copy of it. They are the same screens now, at
 * `/w/<workspaceId>/…`, chosen by the workspace's kind — so this is all that is left of
 * the old tree.
 *
 * The workspace is resolved from the signed-in tutor, not from the id in the path: the
 * only person these addresses ever worked for is the tutor they name.
 */
export default async function TutorWorkspaceMovedPage({ params }: Props) {
  const { locale, rest } = await params;

  const workspace = await getTutorWorkspace();
  if (!workspace) notFound();

  const tail = rest?.length ? `/${rest.join('/')}` : '';
  permanentRedirect(`/${locale}/w/${workspace.schoolId}${tail}`);
}
