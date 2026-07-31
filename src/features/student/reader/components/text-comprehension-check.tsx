'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useIntroduceCard } from '@/features/content';

import { ListeningGapFillStage } from './listening-gapfill-stage';
import { ListeningCompStage } from './listening-comp-stage';
import type {
  ListeningComprehensionItem,
  ListeningGapFillItem,
} from '../lib/parse-listening-exercise';

export interface TextComprehensionCheckProps {
  gapFillItems: ListeningGapFillItem[];
  compItems: ListeningComprehensionItem[];
}

type CheckStage = 'closed' | 'gapfill' | 'comp' | 'done';

/**
 * The post-reading check of a TEXT lesson (spec 17 §5): the same staged
 * exercises an AUDIO lesson runs after its transcript, rendered below the text
 * instead of replacing it — the reader has to be able to look back while
 * answering.
 *
 * Closed until the reader opens it. A check sitting open above the fold invites
 * answering from the questions rather than from the text; opening it is the
 * reader's statement that they have read.
 *
 * Completing the check does **not** complete the lesson — progression stays
 * with the footer's Next (`reader-shell.tsx`), see spec 17 §5.3.
 */
export function TextComprehensionCheck({ gapFillItems, compItems }: TextComprehensionCheckProps) {
  const t = useTranslations('Learning.reader.text.check');
  const [stage, setStage] = useState<CheckStage>('closed');
  // Bumped on retry to remount the stages, clearing their answers.
  const [runKey, setRunKey] = useState(0);
  const introduceCard = useIntroduceCard();
  // Seeding is per exercise, not per attempt: a second run over the same
  // question must not enqueue it twice.
  const seededRef = useRef(new Set<string>());

  const total = gapFillItems.length + compItems.length;
  if (total === 0) return null;

  function seedMissed(exerciseIds: string[]) {
    for (const exerciseId of exerciseIds) {
      if (seededRef.current.has(exerciseId)) continue;
      seededRef.current.add(exerciseId);
      introduceCard.mutate({ contentType: 'EXERCISE', contentId: exerciseId });
    }
  }

  if (stage === 'closed') {
    return (
      <section className="mt-9 rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface px-5.5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--ssz-color-primary-50)' }}
            >
              <Target size={17} className="text-(--ssz-color-primary-600)" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-reading text-[18px] font-semibold text-(--ssz-text-primary)">
                {t('title')}
              </h2>
              <p className="text-[13px] text-(--ssz-text-muted)">{t('questions', { count: total })}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStage(gapFillItems.length > 0 ? 'gapfill' : 'comp')}
            className="inline-flex items-center gap-2 rounded-xl bg-(--ssz-color-primary-500) px-5.5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-(--ssz-color-primary-600) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('start')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-9 rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface px-5.5 py-5.5">
      {stage === 'gapfill' && (
        <ListeningGapFillStage
          key={`gapfill-${runKey}`}
          items={gapFillItems}
          surface="text"
          onNext={(missed) => {
            seedMissed(missed);
            setStage(compItems.length > 0 ? 'comp' : 'done');
          }}
        />
      )}
      {stage === 'comp' && (
        <ListeningCompStage
          key={`comp-${runKey}`}
          items={compItems}
          surface="text"
          onDone={(missed) => {
            seedMissed(missed);
            setStage('done');
          }}
        />
      )}
      {stage === 'done' && (
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <CheckCircle2
              size={22}
              className="shrink-0 text-(--ssz-color-success-500)"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-reading text-[18px] font-semibold text-(--ssz-text-primary)">
                {t('done.heading')}
              </h2>
              <p className="text-[13px] text-(--ssz-text-muted)">{t('done.body')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRunKey((k) => k + 1);
              setStage(gapFillItems.length > 0 ? 'gapfill' : 'comp');
            }}
            className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-(--ssz-border-default) px-4.5 py-2 text-[13.5px] font-semibold text-(--ssz-text-secondary) transition-colors hover:border-(--ssz-color-primary-500) hover:text-(--ssz-color-primary-600) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {t('done.retry')}
          </button>
        </div>
      )}
    </section>
  );
}
