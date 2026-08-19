import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string; id: string }>;
};

/**
 * The per-exercise marking queue, folded into the teacher's inbox (step 45.10).
 *
 * The inbox narrows by course rather than by exercise, and deliberately: an exercise is
 * rarely what a teacher wants to see the whole of, and the inbox already groups by
 * exercise inside the course. So the old address lands on this course's queue, one
 * heading away from the exercise it named.
 */
export default async function ExerciseReviewRedirectPage({ params }: Props) {
  const { locale, schoolSlug, id } = await params;
  redirect(`/${locale}/school/${schoolSlug}/review?course=${encodeURIComponent(id)}`);
}
