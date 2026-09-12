import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';
import { ReviewInbox } from '@/features/review/components/inbox/review-inbox';

type Props = {
  params: Promise<{ userId: string; locale: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations('Review');
  return { title: t('inbox.title') };
}

/**
 * The tutor's marking inbox — the school's screen, addressed by their own workspace.
 *
 * Nothing is copied: the inbox takes the workspace id where a school page hands it a slug,
 * and the BFF resolves a tutor's scope to the one group they teach (plan 59 §4). Oversight
 * has no twin here on purpose — a tutor overseeing their own load is a screen about one
 * person, themselves.
 */
export default async function TutorReviewPage({ params }: Props) {
  await params;

  const workspace = await getTutorWorkspace();
  if (!workspace) notFound();

  return (
    // `h-full`, not `flex-1`: the shell renders pages inside a plain block with a definite
    // height, and a page sized to its content would scroll as a whole, taking the queue's
    // sticky headings off the top of the screen.
    <main className="flex h-full min-h-0 flex-col">
      <Suspense>
        <ReviewInbox school={workspace.schoolId} />
      </Suspense>
    </main>
  );
}
