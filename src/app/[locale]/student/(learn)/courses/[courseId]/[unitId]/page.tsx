import { notFound } from 'next/navigation';

import { UnitEntryRedirect } from '@/features/student/reader';

interface Props {
  params: Promise<{ courseId: string; unitId: string }>;
}

export default async function UnitEntryPage({ params }: Props) {
  const { courseId, unitId } = await params;

  if (!courseId || !unitId) notFound();

  return <UnitEntryRedirect courseId={courseId} unitId={unitId} />;
}
