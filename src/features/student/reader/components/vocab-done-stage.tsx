'use client';

import { BookOpen, Check, ChevronRight, Layers, Repeat, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useBulkIntroduceFromList } from '@/features/content';
import { Link } from '@/lib/i18n/navigation';

import type { ReaderSidebarItem } from '../types';

export interface VocabDoneStageProps {
  knownCount: number;
  learnedCount: number;
  /** The next non-vocab item of the unit — where the words get used. */
  reinforceItem?: ReaderSidebarItem;
  srsVocabDue: number;
  onRestart: () => void;
  vocabularyListId: string;
  /**
   * Words of this list the scheduler has never seen — what the button would add.
   * `null` when that is not known yet, which offers the add without claiming a number.
   */
  pendingCount: number | null;
  /** Fired after a successful add, so the page can re-read what is in the set now. */
  onAdded: () => void;
}

export function VocabDoneStage({
  knownCount,
  learnedCount,
  reinforceItem,
  srsVocabDue,
  onRestart,
  vocabularyListId,
  pendingCount,
  onAdded,
}: VocabDoneStageProps) {
  const t = useTranslations('Learning.reader.vocab.flow.done');
  const tPage = useTranslations('Learning.reader.vocab.page');
  const tContent = useTranslations('Content');
  const tErrors = useTranslations('Errors');

  const bulkIntroduce = useBulkIntroduceFromList();

  /**
   * Handing the words over to the scheduler, as a decision rather than a side effect of
   * having read them. Meeting a word and committing to drill it for weeks are different
   * things, and only the learner knows which one they just did.
   *
   * The whole list is sent, not the words still missing: introducing is idempotent per
   * (user × item), so the ones already in the set come back as `skipped`. Selecting them
   * client-side would only add a way for the two sides to disagree.
   */
  function addToStudySet() {
    bulkIntroduce.mutate(
      { vocabularyListId },
      {
        onSuccess: () => {
          toast.success(t('addDone'));
          onAdded();
        },
        onError: () => toast.error(tErrors('unknown')),
      },
    );
  }

  return (
    <div>
      <div className="flex flex-col items-center gap-2 rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-(--ssz-bg-accent) px-6 py-10 text-center">
        <Sparkles size={24} className="text-(--ssz-text-accent)" aria-hidden="true" />
        <p className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</p>
        <p className="text-sm text-(--ssz-text-secondary)">
          {t('summary', { known: knownCount, learned: learnedCount })}
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-1 text-xs font-semibold text-(--ssz-text-accent) hover:underline"
        >
          {t('restart')}
        </button>
      </div>

      <div className="mt-6.5 border-t border-(--ssz-border-default) pt-5.5">
        <div className="mb-3 text-[11px] font-bold tracking-wider text-(--ssz-text-muted) uppercase">
          {t('addHeading')}
        </div>
        {pendingCount === null || pendingCount > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-(--ssz-border-default) bg-surface px-4 py-3.5 shadow-(--ssz-shadow-xs)">
            <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-md bg-(--ssz-bg-accent)">
              <Layers size={18} className="text-(--ssz-text-accent)" aria-hidden="true" />
            </div>
            <div className="min-w-48 flex-1">
              <div className="text-sm font-bold text-(--ssz-text-primary)">
                {pendingCount === null
                  ? t('addTitleUnknown')
                  : t('addTitle', { count: pendingCount })}
              </div>
              <div className="text-xs text-(--ssz-text-muted)">{t('addBody')}</div>
            </div>
            <Button
              size="sm"
              className="gap-2"
              disabled={bulkIntroduce.isPending}
              onClick={addToStudySet}
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              {bulkIntroduce.isPending ? t('adding') : t('addCta')}
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-(--ssz-text-secondary)">
            <Check size={15} className="text-(--ssz-feedback-ok-fg)" aria-hidden="true" />
            {t('addAllIn')}
          </p>
        )}
      </div>

      {(reinforceItem || srsVocabDue > 0) && (
        <div className="mt-6.5 border-t border-(--ssz-border-default) pt-5.5">
          <div className="mb-3 text-[11px] font-bold tracking-wider text-(--ssz-text-muted) uppercase">
            {tPage('nextHeading')}
          </div>
          <div className="flex flex-col gap-2.5">
            {reinforceItem && (
              <Link
                href={reinforceItem.href}
                className="flex items-center gap-3 rounded-xl border-[1.5px] border-(--ssz-border-default) bg-surface px-4 py-3.5 shadow-(--ssz-shadow-xs) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              >
                <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-md bg-(--ssz-bg-accent)">
                  <BookOpen size={18} className="text-(--ssz-text-accent)" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-(--ssz-text-primary)">
                    {reinforceItem.title}
                  </div>
                  <div className="text-xs text-(--ssz-text-muted)">
                    {tContent(`materialType.${reinforceItem.kind}`)}
                  </div>
                </div>
                <ChevronRight size={18} className="text-(--ssz-text-muted)" aria-hidden="true" />
              </Link>
            )}
            {srsVocabDue > 0 && (
              <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-(--ssz-border-accent-warm) bg-(--ssz-bg-accent-warm) px-4 py-3.5">
                <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-md border border-(--ssz-border-accent-warm) bg-surface">
                  <Repeat size={18} className="text-(--ssz-icon-accent-warm)" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-(--ssz-text-primary)">
                    {tPage('reviewTitle')}
                  </div>
                  <div className="text-xs text-(--ssz-text-secondary)">
                    {tPage('reviewBody', { count: srsVocabDue })}
                  </div>
                </div>
                <Link
                  href="/student/srs"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-(--ssz-border-accent-warm) bg-surface px-3.5 py-2 text-xs font-semibold text-(--ssz-text-accent-warm) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
                >
                  <Repeat size={13} aria-hidden="true" />
                  {tPage('reviewCta')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
