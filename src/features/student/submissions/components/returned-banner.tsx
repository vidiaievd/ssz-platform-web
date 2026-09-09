'use client';

import { useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { Undo2 } from 'lucide-react';

import type { ReturnedVerdict } from '../types';

const TONE = 'oklch(0.62 0.11 82)';

/**
 * What the teacher said, over the exercise it was said about (plan 47.3).
 *
 * The comment belongs on the same screen as the second attempt, not in a notification the
 * learner has to remember (criterion 39). For the templates redone in the runner that
 * means here, above the task — so the correction is made while the remark is in view,
 * rather than from memory of a card two navigations back.
 *
 * It is fetched, not passed: the runner is reached by a link that can be reloaded,
 * bookmarked or opened tomorrow, and a banner carried in navigation state would be gone by
 * the second of those. Nothing is shown while it loads and nothing if it fails — an
 * exercise that opens without its banner is still an exercise the learner can do, and an
 * error card over a working task would be the worse trade.
 */
export function ReturnedBanner({
  exerciseId,
  attemptId,
}: {
  exerciseId: string;
  attemptId: string;
}) {
  const t = useTranslations('Review.student.redo');
  const format = useFormatter();

  const { data } = useQuery<ReturnedVerdict>({
    queryKey: ['my-submissions', 'verdict', exerciseId, attemptId] as const,
    queryFn: async () => {
      const response = await fetch(`/api/exercises/${exerciseId}/attempts/${attemptId}/verdict`);
      if (!response.ok) throw new Error('Failed to load the verdict');
      return response.json() as Promise<ReturnedVerdict>;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Only a returned verdict explains why the learner is here doing this again. A pending
  // or already-marked attempt behind the same link is a stale address, and a banner drawn
  // from it would be telling them to fix something nobody asked them to fix.
  if (!data || data.status !== 'RETURNED') return null;

  const when = data.at === null ? null : format.relativeTime(new Date(data.at));

  return (
    <aside
      className="mb-5 rounded-[13px] border-[1.5px] px-4 py-3.5"
      style={{
        borderColor: `color-mix(in oklch, ${TONE} 45%, var(--ssz-border-default))`,
        background: `color-mix(in oklch, ${TONE} 7%, var(--ssz-bg-surface))`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: `color-mix(in oklch, ${TONE} 12%, transparent)`, color: TONE }}
        >
          <Undo2 size={15} />
        </span>
        <p className="text-[13px] font-semibold">
          {data.teacherName === null
            ? t('bannerUnsigned')
            : t('banner', { teacher: data.teacherName })}
          {when !== null && (
            <span className="ml-1.5 font-normal text-(--ssz-text-muted)">{when}</span>
          )}
        </p>
      </div>

      {data.comment !== null && data.comment !== '' && (
        <p
          className="mt-2.5 text-[14.5px] leading-relaxed"
          style={{ fontFamily: 'var(--ssz-font-reading)' }}
        >
          {data.comment}
        </p>
      )}
    </aside>
  );
}
