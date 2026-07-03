import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { CourseHomePage } from '@/features/student/course-home';

interface Props {
  params: Promise<{ courseId: string }>;
}

export default async function StudentCourseHomePage({ params }: Props) {
  const [{ courseId }, locale] = await Promise.all([params, getLocale()]);

  if (!courseId) notFound();

  return <CourseHomePage courseId={courseId} locale={locale} />;
}
