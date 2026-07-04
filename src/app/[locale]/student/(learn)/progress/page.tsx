import { getLocale } from 'next-intl/server';

import { ProgressDashboard } from '@/features/student/progress';

interface Props {
  searchParams: Promise<{ courseId?: string }>;
}

export default async function StudentProgressPage({ searchParams }: Props) {
  const [{ courseId }, locale] = await Promise.all([searchParams, getLocale()]);
  void locale;

  return <ProgressDashboard courseId={courseId} role="student" />;
}
