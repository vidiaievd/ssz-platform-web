import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { ReviewInbox } from '@/features/review/components/inbox/review-inbox';

type Props = {
  params: Promise<{ workspaceId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Review');
  return { title: `${t('inbox.title')} · ${workspaceId}` };
}

/**
 * The review inbox — the subsystem's main screen.
 *
 * A thin server component on purpose. Everything on this screen is a live thing: two
 * teachers may be working the same queue, submissions arrive while it is open, and the
 * view is driven from searchParams a client component owns. Prefetching the first page
 * here would hand the browser a list that is already out of date and buy a flash of stale
 * rows for it.
 *
 * Who may be here is settled twice, and neither time on this page. The layout above
 * already refuses anyone who is not staff of this school; the BFF then refuses anyone
 * whose scope does not cover what they ask for, which is the check that actually matters,
 * because a URL is not an authorisation.
 */
export default async function SchoolReviewPage({ params }: Props) {
  const { workspaceId } = await params;

  // By id, not by slug: a solo workspace has a slug of its own making, and the review
  // scope only ever recognises a tutor's workspace by its id — a queue asked for by slug
  // came back 403 on the tutor's own work.
  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  return (
    // `h-full`, not `flex-1`: the shell renders its pages inside a plain block with a
    // definite height, where a flex child's grow factor means nothing — and a page that
    // sized itself to its content would scroll as a whole, taking the queue's sticky
    // headings and the panel's header off the top of the screen with it.
    <main className="flex h-full min-h-0 flex-col">
      <Suspense>
        <ReviewInbox school={workspace.id} />
      </Suspense>
    </main>
  );
}
