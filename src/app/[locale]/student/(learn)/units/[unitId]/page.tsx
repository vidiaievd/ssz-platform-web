import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { UnitFlowShell } from '@/features/student/unit-flow';

interface Props {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ courseId?: string }>;
}

export default async function UnitFlowPage({ params, searchParams }: Props) {
  const [{ unitId }, { courseId }, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);

  if (!unitId) notFound();

  const courseHref = courseId
    ? `/${locale}/student/courses/${courseId}`
    : `/${locale}/student/courses`;

  return <UnitFlowShell unitId={unitId} courseHref={courseHref} />;
}
