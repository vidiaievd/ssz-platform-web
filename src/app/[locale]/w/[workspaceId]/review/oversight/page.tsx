import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { OversightScreen } from '@/features/review/components/oversight/oversight-screen';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

/** Who runs a school's review, as opposed to doing it (`BEHAVIOR.md` §C). */
const OVERSIGHT_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Review.oversight');
  return { title: `${t('title')} · ${workspaceId}` };
}

/**
 * The school's review load — one screen, opened about once a week.
 *
 * A thin server component: everything here is live and period-dependent, and the answer is
 * already cached for a minute in the BFF, so prefetching it would buy a duplicate of the
 * same round trip.
 *
 * `notFound` rather than a refusal for a teacher who reaches the URL: the screen shows
 * every colleague's load by name, and that is not something to tell someone they are being
 * kept from. The BFF refuses the same person independently — a URL is not an authorisation.
 */
export default async function SchoolReviewOversightPage({ params }: Props) {
  const { workspaceId } = await params;

  const workspace = await resolveWorkspace(workspaceId);

  // A tutor owns their workspace, so a role check alone would let them in — and this is a
  // screen about how a staff of reviewers is coping, which a workspace of one does not
  // have. Plan 59 withheld it from the tutor's shell; the address must withhold it too.
  if (!workspace || workspace.kind === 'SOLO') notFound();
  if (!OVERSIGHT_ROLES.includes(workspace.myRole)) notFound();

  return (
    <main className="h-full overflow-y-auto">
      <Suspense>
        <OversightScreen school={workspaceId} />
      </Suspense>
    </main>
  );
}
