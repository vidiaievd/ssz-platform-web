import { AlertTriangle, ClipboardCheck, Repeat } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { ReviewBlock, ReviewBlockOccurrence } from '@/lib/scheduling/provider';
import { ReviewBlockActionsMenu } from './review-block-actions-menu';

type Props = {
  occurrence: ReviewBlockOccurrence;
  /** The rule behind the sitting, for the editor; absent only if the read lost it. */
  block: ReviewBlock | undefined;
  /** The sitting runs into a lesson or another block that day. */
  overlaps: boolean;
  workspaceId: string;
};

/**
 * One sitting of the teacher's time for marking (plan 81).
 *
 * Drawn unlike a lesson on purpose — dashed, no group, no topic — so a week full of both
 * still reads at a glance as "teaching" and "marking". An overlap is a note, not a
 * refusal: the server lets a block sit on a lesson, and the card marks it with a sign
 * that has words behind it, since colour alone would not carry it.
 */
export async function ReviewBlockCard({ occurrence, block, overlaps, workspaceId }: Props) {
  const t = await getTranslations('Scheduling.my.reviewBlocks');
  const time = `${occurrence.start}–${occurrence.end}`;

  return (
    <div
      className={`rounded-lg border border-dashed bg-primary/5 p-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring ${
        overlaps ? 'border-warning-400 dark:border-warning-700' : 'border-primary/40'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-(--ssz-text-muted)">
        <ClipboardCheck className="size-3" aria-hidden="true" />
        <span className="tabular-nums">{time}</span>
        <span className="ml-auto flex items-center gap-1">
          {/* A week column is too narrow for the sentence, so the sign carries it — with
              the words as its name and its tooltip. */}
          {overlaps && (
            <span title={t('overlapsHint')} className="text-warning-700 dark:text-warning-400">
              <AlertTriangle className="size-3" aria-hidden="true" />
              <span className="sr-only">{t('overlapsHint')}</span>
            </span>
          )}
          {occurrence.repeat === 'weekly' && <Repeat className="size-3" aria-label={t('weekly')} />}
        </span>
      </div>

      <div className="mt-1 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-(--ssz-text-primary)">{t('title')}</p>
          {occurrence.note && (
            <p title={occurrence.note} className="truncate text-xs text-(--ssz-text-muted)">
              {occurrence.note}
            </p>
          )}
        </div>

        {block && (
          <ReviewBlockActionsMenu
            workspaceId={workspaceId}
            block={block}
            date={occurrence.date}
            label={`${t('title')}, ${time}`}
          />
        )}
      </div>
    </div>
  );
}
