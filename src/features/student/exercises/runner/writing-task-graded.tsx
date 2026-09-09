'use client';

import { Check, MessageSquare, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  scoreRubric,
  type RubricSnapshot,
  type ShowRubricPolicy,
} from '@/lib/shared-kernel/writing-task';

/**
 * The three outcomes the handoff names, and how they are told apart.
 *
 * Only two of them are verdicts. The platform's domain has `approved | returned`, and
 * BEHAVIOR §7 has the same: a failing score is one state, and what separates
 * `Til omskriving` from `Ikke bestått` is the author's `revision` setting — whether the
 * learner may write it again — not a third decision by the teacher.
 */
export type WritingTaskOutcome = 'passed' | 'rewrite' | 'failed';

export function outcomeOf(passed: boolean | null, revision: string): WritingTaskOutcome {
  if (passed === true) return 'passed';
  return revision === 'once' ? 'failed' : 'rewrite';
}

export interface WritingTaskGradedProps {
  /** True when the teacher's marks cleared the threshold. */
  passed: boolean | null;
  /** The author's revision policy — it decides whether a failure may be rewritten. */
  revision: string;
  /** Whether the criteria may be shown at all; `never` leaves only the score. */
  showRubric: ShowRubricPolicy;
  /** The criteria as they stood when the work was queued. Null on an older attempt. */
  snapshot?: RubricSnapshot | null;
  /** The mark 0-3 the teacher set per criterion. */
  marks?: Record<string, number> | null;
  /** The percentage the engine recorded, used when there is no rubric to show. */
  score?: number | null;
  comment?: string | null;
  /** Offered only when the outcome is `rewrite`. */
  onRewrite?: () => void;
  /** Which try the rewrite would be — the button says so. */
  nextAttemptNo?: number;
}

/**
 * What the teacher decided, as the learner reads it.
 *
 * The score is shown in rubric points rather than as the percentage the attempt carries
 * (`N / M poeng`): points are the unit the author set the threshold in and the unit the
 * teacher marked in, and a text worth 11 of 15 is not "73%" to anyone who wrote it. The
 * percentage exists for the SRS, which is not a reader.
 *
 * Nothing here is computed from the text. The marks are a person's judgement, and this
 * only adds them up — with the same function the server used to derive the verdict, so
 * the number under the chip and the verdict beside it cannot come apart.
 */
export function WritingTaskGraded({
  passed,
  revision,
  showRubric,
  snapshot = null,
  marks = null,
  score = null,
  comment = null,
  onRewrite,
  nextAttemptNo = 2,
}: WritingTaskGradedProps) {
  const t = useTranslations('ExerciseRunner');
  const outcome = outcomeOf(passed, revision);
  const ok = outcome === 'passed';

  const rubric = snapshot === null ? null : scoreRubric(snapshot, marks ?? {});
  const criteria = showRubric === 'never' ? [] : (snapshot?.criteria ?? []);

  return (
    <div
      role="status"
      className="mt-4 rounded-2xl border px-4 py-3"
      style={{
        borderColor: ok ? 'var(--ssz-feedback-ok-line)' : 'var(--ssz-border-default)',
        background: ok ? 'var(--ssz-feedback-ok-bg)' : 'var(--ssz-bg-surface-subtle)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-[14px] font-bold"
          style={{ color: ok ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-text-primary)' }}
        >
          {ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
          {t(`writingTask.outcome.${outcome}`)}
        </span>

        {/*
          Points when there is a rubric behind them, the recorded percentage when there
          is not — an attempt graded before the rubric existed, or one graded per item.
          Never both: two numbers for one mark is a puzzle, not a result.
        */}
        {rubric !== null ? (
          <span
            className="ml-auto text-[13px] tabular-nums"
            style={{ color: 'var(--ssz-text-secondary)' }}
          >
            {t('writingTask.points', { score: rubric.points, max: rubric.max })}
          </span>
        ) : (
          score !== null && (
            <span
              className="ml-auto text-[13px] tabular-nums"
              style={{ color: 'var(--ssz-text-secondary)' }}
            >
              {t('writingTask.percent', { score })}
            </span>
          )
        )}
      </div>

      {criteria.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2.5">
          {criteria.map((criterion) => {
            const mark = marks?.[criterion.id] ?? 0;
            return (
              <li key={criterion.id} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: 'var(--ssz-text-primary)' }}
                  >
                    {criterion.name}
                    {criterion.weight === 2 && (
                      <span className="ml-1.5" style={{ color: 'var(--ssz-text-muted)' }}>
                        ×2
                      </span>
                    )}
                  </p>
                  {/*
                    The descriptor for the mark the teacher actually gave — the sentence
                    the author wrote for this level. It is the whole reason the criteria
                    are worth showing: "2/3" says how much, and only this says what for.
                  */}
                  {criterion.levels[mark]?.trim() !== '' && (
                    <p className="text-[12.5px]" style={{ color: 'var(--ssz-text-secondary)' }}>
                      {criterion.levels[mark]}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background:
                          mark > i ? 'var(--ssz-text-secondary)' : 'var(--ssz-border-default)',
                      }}
                    />
                  ))}
                </span>
                <span
                  className="text-[12.5px] tabular-nums"
                  style={{ color: 'var(--ssz-text-secondary)' }}
                >
                  {t('writingTask.mark', { mark })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {comment != null && comment.trim() !== '' && (
        <div className="mt-3 flex items-start gap-2">
          <MessageSquare
            size={15}
            aria-hidden="true"
            style={{ color: 'var(--ssz-text-muted)', flexShrink: 0, marginTop: 2 }}
          />
          <p className="text-[13px]" style={{ color: 'var(--ssz-text-primary)' }}>
            {comment}
          </p>
        </div>
      )}

      {/*
        Offered on `rewrite` only. A pass has nothing to redo, and `revision: 'once'` is
        the author saying there is one submission — a button that contradicted that would
        promise a second reading nobody agreed to give.
      */}
      {outcome === 'rewrite' && onRewrite !== undefined && (
        <button
          type="button"
          onClick={onRewrite}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold underline underline-offset-2"
          style={{ color: 'var(--ssz-text-secondary)' }}
        >
          <RotateCcw size={13} aria-hidden="true" />
          {t('writingTask.rewrite', { n: nextAttemptNo })}
        </button>
      )}
    </div>
  );
}
