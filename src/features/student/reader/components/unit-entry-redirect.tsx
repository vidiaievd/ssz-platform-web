'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { EmptyState, ErrorState, LearningSkeleton, useUnitContents } from '@/features/learning';
import type { UnitContentsItem } from '@/features/learning';
import { Link, useRouter } from '@/lib/i18n/navigation';

import { buildItemHref } from '../lib/map-reader-data';

export interface UnitEntryRedirectProps {
  courseId: string;
  unitId: string;
}

/** First in-progress item, else first available item, else the very first item. */
function pickEntryItem(items: UnitContentsItem[]): UnitContentsItem | undefined {
  return (
    items.find((i) => i.status === 'in_progress') ??
    items.find((i) => i.status === 'available') ??
    items[0]
  );
}

/** Resolves the unit's entry item and redirects to its route (`:courseId/:unitId/:itemId`). */
export function UnitEntryRedirect({ courseId, unitId }: UnitEntryRedirectProps) {
  const t = useTranslations('Learning.reader.entry');
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useUnitContents(unitId);

  const items = data ? [...data.sections.flatMap((s) => s.items), ...data.ungroupedItems] : [];
  const entryItem = pickEntryItem(items);

  useEffect(() => {
    if (entryItem) {
      router.replace(buildItemHref(courseId, unitId, entryItem.id));
    }
  }, [entryItem, courseId, unitId, router]);

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--ssz-bg-base)">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!isLoading && !entryItem) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--ssz-bg-base)">
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Link href={`/student/courses/${courseId}`} className="text-sm font-semibold text-primary-500">
              {t('backToCourse')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-(--ssz-bg-base)">
      <LearningSkeleton variant="list" rows={5} className="w-80" />
    </div>
  );
}
