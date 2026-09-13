import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { resolveWorkspace } from '@/features/workspaces/api/resolve-workspace';
import { SubmissionPanel } from '@/features/review/components/submission/submission-panel';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = {
  params: Promise<{ workspaceId: string; submissionId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { workspaceId } = await params;
  const t = await getTranslations('Review');
  return { title: `${t('inbox.eyebrow')} · ${workspaceId}` };
}

/**
 * One submission as a page of its own — the narrow-screen half of the split.
 *
 * Below 1024px the inbox hides its second column entirely, so without this route a phone
 * could open the queue and nothing in it. It is the same panel, and deliberately not a
 * different screen: a reviewer who marks on a laptop and checks the queue on a train
 * should be reading one thing in two shapes, not learning two.
 *
 * The way back is a link to the queue rather than browser history, because the usual way
 * to arrive here is a notification, where there is no history to go back through.
 */
export default async function SubmissionPage({ params }: Props) {
  const { workspaceId, submissionId, locale } = await params;

  // By id, not by slug: a solo workspace has a slug of its own making, and the review
  // scope only ever recognises a tutor's workspace by its id — a queue asked for by slug
  // came back 403 on the tutor's own work.
  const workspace = await resolveWorkspace(workspaceId);
  if (!workspace) notFound();

  const t = await getTranslations('Review');

  return (
    <main className="flex h-full min-h-0 flex-col">
      <Link
        href={`/${locale}${wsHref(workspaceId, 'review')}`}
        className="flex items-center gap-1.5 px-5 pt-4 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t('submission.back')}
      </Link>
      <SubmissionPanel school={workspace.id} id={submissionId} />
    </main>
  );
}
