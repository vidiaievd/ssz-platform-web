'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';

import type { ProvisionalVerdict } from '@/features/student/exercises/types/attempts';

import { useProvisionalVerdict } from '../api/use-provisional-verdict';

import { AiReviewPanel } from './ai-review-panel';

/**
 * A model's provisional verdict on a school's work (plan 80 §3; OQ-110): what it ruled, that
 * it does not count yet, and when it would — then its remarks, with no dispute (the teacher's
 * verdict comes after it). Shared by the runners and «My work».
 */
export function ProvisionalVerdictCard({
  exerciseId,
  attemptId,
  templateCode,
  verdict,
  promptLabel,
  passageOf,
}: {
  exerciseId: string;
  attemptId: string;
  templateCode: string;
  verdict: ProvisionalVerdict;
  promptLabel?: (itemId: string) => string;
  passageOf?: (itemId: string) => string | null;
}) {
  const t = useTranslations('Review.aiFirst');
  const format = useFormatter();
  const approved = verdict.outcome === 'approved';

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-relaxed">
        <span
          className="font-semibold"
          style={{
            color: approved ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-feedback-no-fg)',
          }}
        >
          {approved ? t('approved') : t('returned')}
        </span>{' '}
        <span className="text-(--ssz-text-secondary)">
          {verdict.countsAt === null
            ? t('teacherDecides')
            : t('countsAt', {
                when: format.dateTime(new Date(verdict.countsAt), {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
        </span>
      </p>
      <AiReviewPanel
        exerciseId={exerciseId}
        attemptId={attemptId}
        templateCode={templateCode}
        provisional
        {...(promptLabel ? { promptLabel } : {})}
        {...(passageOf ? { passageOf } : {})}
      />
    </div>
  );
}

/**
 * Under «sent to your teacher», for a school that has a model read the work first: the
 * model's provisional verdict once it is in, and until then that it is coming. The screen
 * waits for it here, by itself — the runner's own flow (waiting for the teacher) is unchanged.
 */
export function AiFirstPanel({
  exerciseId,
  attemptId,
  templateCode,
  initial = null,
  promptLabel,
  passageOf,
}: {
  exerciseId: string;
  attemptId: string;
  templateCode: string;
  /** The provisional verdict the attempt was read back with, if any. */
  initial?: ProvisionalVerdict | null;
  promptLabel?: (itemId: string) => string;
  passageOf?: (itemId: string) => string | null;
}) {
  const t = useTranslations('Review.aiFirst');
  // A plain link: this panel sits inside every solver's import graph, which must not pull
  // the i18n router in (it breaks the runner's test suites).
  const locale = useLocale();
  const wait = useProvisionalVerdict(exerciseId, attemptId, initial);

  if (wait.stage === 'ready') {
    return (
      <ProvisionalVerdictCard
        exerciseId={exerciseId}
        attemptId={attemptId}
        templateCode={templateCode}
        verdict={wait.verdict}
        {...(promptLabel ? { promptLabel } : {})}
        {...(passageOf ? { passageOf } : {})}
      />
    );
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-[11px] border-[1.5px] border-dashed border-(--ssz-border-strong) bg-(--ssz-bg-surface) px-3.5 py-3 text-[13px] leading-relaxed text-(--ssz-text-secondary)"
    >
      {wait.stage === 'reading' ? (
        <Loader2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin" />
      ) : (
        <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-(--ssz-text-accent)" />
      )}
      <p>
        {wait.stage === 'reading' ? t('reading') : wait.stage === 'slow' ? t('slow') : t('settled')}
        {wait.stage !== 'reading' && (
          <>
            {' '}
            <a
              href={`/${locale}/student/submissions`}
              className="font-semibold underline underline-offset-2"
            >
              {t('myWork')}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
