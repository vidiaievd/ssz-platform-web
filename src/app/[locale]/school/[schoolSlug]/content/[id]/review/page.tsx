import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string; id: string }>;
};

/**
 * The course inbox, folded into the teacher's inbox (step 45.10).
 *
 * Kept as a redirect rather than deleted: this address is what the course editor linked
 * to for two months, and it is the sort of link a teacher bookmarks or pastes to a
 * colleague. The course arrives as a filter, so the screen that opens is the one the old
 * address promised — this course's queue — inside the screen that also answers "and what
 * else is waiting on me".
 */
export default async function CourseReviewRedirectPage({ params }: Props) {
  const { locale, schoolSlug, id } = await params;
  redirect(`/${locale}/school/${schoolSlug}/review?course=${encodeURIComponent(id)}`);
}
