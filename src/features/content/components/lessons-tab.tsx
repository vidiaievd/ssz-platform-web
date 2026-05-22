'use client';

import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';

import { DataState } from '@/components/shared/data-state';
import { Link } from '@/lib/i18n/navigation';
import { useContainerItems } from '../api/use-container-items';
import type { ContainerItem } from '../types';

interface LessonsTabProps {
  containerId: string;
  versionId?: string;
}

function LessonRow({ item }: { item: ContainerItem }) {
  return (
    <Link
      href={`/student/enrolled/lessons/${item.contentId}`}
      className="hover:bg-muted flex items-center gap-3 rounded-lg px-4 py-3 transition-colors"
    >
      <BookOpen className="text-muted-foreground h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">{item.title ?? item.contentId}</span>
    </Link>
  );
}

export function LessonsTab({ containerId, versionId }: LessonsTabProps) {
  const t = useTranslations('Content');
  const { data, isLoading, error, refetch } = useContainerItems(
    containerId,
    versionId ?? '',
    !!versionId,
  );

  const items = (data ?? []).filter((i) => i.contentType === 'LESSON');

  return (
    <DataState
      isLoading={isLoading}
      error={error ? { code: 'unknown' } : null}
      isEmpty={!isLoading && items.length === 0}
      onRetry={() => void refetch()}
      emptySlot={
        <p className="text-muted-foreground py-8 text-center text-sm">{t('noLessons')}</p>
      }
    >
      <div className="divide-border divide-y rounded-lg border">
        {items.map((item) => (
          <LessonRow key={item.id} item={item} />
        ))}
      </div>
    </DataState>
  );
}
