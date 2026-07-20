'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useSrsDue } from '@/features/learning/api/use-srs-due';
import { CadenceCard } from './cadence-card';

/**
 * Feeds `CadenceCard` today's real review count. The 7-day dot row stays
 * unset: learning-service records no activity history, and a fabricated row
 * would be exactly the vanity metric the redesign removes.
 */
export function StudyRhythmPanel() {
  const { data, isLoading } = useSrsDue();

  if (isLoading) {
    return <Skeleton className="h-33 w-full rounded-lg" />;
  }

  return <CadenceCard reviewedToday={data?.reviewedToday ?? 0} />;
}
