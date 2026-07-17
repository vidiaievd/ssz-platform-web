import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ReaderShell } from '@/features/student/reader';

interface Props {
  params: Promise<{ courseId: string; unitId: string; itemId: string }>;
}

export default async function ReaderItemPage({ params }: Props) {
  const { courseId, unitId, itemId } = await params;

  if (!courseId || !unitId || !itemId) notFound();

  const t = await getTranslations('Learning.reader.body');

  return (
    <ReaderShell courseId={courseId} unitId={unitId} itemId={itemId}>
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-6 py-16 text-center">
        <p className="text-lg font-medium text-(--ssz-text-primary)">{t('comingSoonTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('comingSoonBody')}</p>
      </div>
    </ReaderShell>
  );
}
