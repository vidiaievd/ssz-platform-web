import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { ReviewInbox } from '@/features/review/components/inbox/review-inbox';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Review');
  return { title: `${t('inbox.title')} · ${schoolSlug}` };
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
  const { schoolSlug } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  return (
    // The split fills what the shell leaves it: this screen scrolls in its columns, not
    // as a page, or the queue's sticky group headings would have nothing to stick to.
    <main className="flex min-h-0 flex-1 flex-col">
      <Suspense>
        <ReviewInbox school={school.slug ?? school.id} />
      </Suspense>
    </main>
  );
}
