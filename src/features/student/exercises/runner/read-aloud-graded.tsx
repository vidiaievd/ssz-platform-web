'use client';

import { Check, Play, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  readMarks,
  readSpeakingSnapshot,
  scorePrompts,
  type ShowModelPolicy,
  type ShowRubricPolicy,
  type SubmittedRecording,
} from '@/lib/shared-kernel/read-aloud';

import {
  RA_FOCUS,
  RA_MONO,
  TakeNumber,
  TakePlayer,
  takeRowStyle,
  type TakeSource,
} from './read-aloud-parts';
import { outcomeOf } from './writing-task-graded';

export interface ReadAloudGradedProps {
  /** The attempt's verdict, from the server — never recomputed here (deviation 19). */
  passed: boolean | null;
  revision: string;
  showRubric: ShowRubricPolicy;
  showModel: ShowModelPolicy;
  /** The rubric frozen when the work was queued; arrives only with a verdict. */
  snapshot: unknown;
  /** `itemId:criterionId` → 0–3. */
  marks: unknown;
  /** The teacher's word per prompt, and whether the prompt passed (Q1-A). */
  decisions: readonly { itemId: string; approved: boolean; comment?: string }[] | null;
  /** A word on the submission as a whole, when the teacher left one. */
  comment?: string | null;
  /** What was handed in, prompt by prompt, in that order. */
  recordings: readonly SubmittedRecording[];
  labelOf: (itemId: string) => string;
  sourceOf: (ref: string | null, assetId: string | null) => TakeSource;
  /** The model reading can be heard again — set only when there is a clip and `showModel` allows. */
  onPlayModel?: () => void;
  /** Offered when the verdict is a return and `revision: 'return'`. */
  onRedo?: () => void;
  interactive?: boolean;
}

/**
 * The teacher's verdict, as the learner reads it — the prototype's `GradedCard`, per prompt
 * (plan 70, Q1-A).
 *
 * Three prompts are three verdicts, never one averaged mark (README idea 1): every prompt gets
 * its own points, its criteria with the level the teacher chose and the descriptor of that
 * level, and the teacher's comment. The head says how the whole went — the attempt's outcome,
 * and for more than one prompt how many passed. For a single prompt the card is the
 * prototype's own: the outcome chip, `N / M poeng`, the rows, the comment.
 *
 * The points are added up with the function the server used, against the snapshot it froze —
 * so the number and the chip cannot come apart. The verdict itself is the server's (`passed`,
 * `approved` per prompt): nothing here decides it.
 */
export function ReadAloudGraded({
  passed,
  revision,
  showRubric,
  showModel,
  snapshot: rawSnapshot,
  marks: rawMarks,
  decisions,
  comment = null,
  recordings,
  labelOf,
  sourceOf,
  onPlayModel,
  onRedo,
  interactive = true,
}: ReadAloudGradedProps) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const outcome = outcomeOf(passed, revision);
  const ok = outcome === 'passed';

  const snapshot = readSpeakingSnapshot(rawSnapshot);
  const marks = readMarks(rawMarks);
  const itemIds = recordings.map((r) => r.itemId);
  const score = snapshot === null ? null : scorePrompts(snapshot, marks, itemIds);
  const byItem = new Map((decisions ?? []).map((d) => [d.itemId, d]));
  const criteria =
    showRubric === 'never' || snapshot === null
      ? []
      : snapshot.criteria.filter((c) => c.studentVisible);
  const single = recordings.length === 1;
  const passedCount = itemIds.filter((id) => byItem.get(id)?.approved === true).length;

  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-(--ssz-radius-md) border p-(--ssz-space-4)"
      style={{
        background: 'var(--ssz-bg-surface)',
        borderColor: ok ? 'var(--ssz-color-success-500)' : 'var(--ssz-color-warning-500)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-[7px] rounded-full px-2.5 py-[3px] text-xs font-semibold"
          style={
            ok
              ? { background: 'var(--ssz-color-success-50)', color: 'var(--ssz-color-success-700)' }
              : { background: 'var(--ssz-color-warning-50)', color: 'var(--ssz-color-warning-700)' }
          }
        >
          {ok ? (
            <Check size={13} aria-hidden="true" />
          ) : outcome === 'rewrite' ? (
            <RefreshCw size={13} aria-hidden="true" />
          ) : (
            <X size={13} aria-hidden="true" />
          )}
          {outcome === 'passed'
            ? t('graded.outcome.passed')
            : outcome === 'rewrite'
              ? t('graded.outcome.rewrite')
              : t('graded.outcome.failed')}
        </span>
        <span className="flex-1" />
        {single && score !== null && score.prompts[0] !== undefined ? (
          <b className="text-sm tabular-nums">
            {t('graded.points', {
              score: score.prompts[0].outcome.points,
              max: score.prompts[0].outcome.max,
            })}
          </b>
        ) : (
          !single && (
            <b className="text-sm tabular-nums">
              {t('graded.passedCount', { k: passedCount, n: recordings.length })}
            </b>
          )
        )}
      </div>

      {recordings.map((r, i) => {
        const result = score?.prompts.find((p) => p.itemId === r.itemId)?.outcome ?? null;
        const decision = byItem.get(r.itemId);
        return (
          <section
            key={r.itemId}
            aria-label={labelOf(r.itemId)}
            className={single ? 'flex flex-col' : 'flex flex-col gap-1.5 border-t pt-2.5'}
            style={single ? undefined : { borderColor: 'var(--ssz-border-default)' }}
          >
            {!single && (
              <div className="flex items-center gap-2">
                <TakeNumber n={i + 1} selected={decision?.approved === true} />
                <strong className="min-w-0 flex-1 truncate text-sm">{labelOf(r.itemId)}</strong>
                {decision !== undefined && (
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: decision.approved
                        ? 'var(--ssz-color-success-700)'
                        : 'var(--ssz-color-warning-700)',
                    }}
                  >
                    {decision.approved ? t('graded.promptPassed') : t('graded.promptAgain')}
                  </span>
                )}
                {result !== null && (
                  <b className="text-sm tabular-nums">
                    {t('graded.points', { score: result.points, max: result.max })}
                  </b>
                )}
              </div>
            )}
            {!single && (
              <div className="flex items-center gap-2.5" style={takeRowStyle(false)}>
                <TakePlayer
                  source={sourceOf(null, r.assetId)}
                  seconds={r.seconds}
                  label={labelOf(r.itemId)}
                  interactive={interactive}
                />
              </div>
            )}

            {showRubric === 'never' || snapshot === null ? (
              <p className="m-0 text-xs text-(--ssz-text-muted)">{t('graded.hidden')}</p>
            ) : (
              criteria.map((c) => {
                const key = `${r.itemId}:${c.id}`;
                const level = marks[key] ?? 0;
                return (
                  <div
                    key={c.id}
                    className="grid items-center gap-2 border-t py-2"
                    style={{
                      gridTemplateColumns: 'minmax(0,1fr) auto',
                      borderColor: 'var(--ssz-border-default)',
                    }}
                  >
                    <div>
                      <strong className="block text-sm">{c.name}</strong>
                      {c.levels[level]?.trim() && (
                        <span
                          className="mt-0.5 block text-xs text-(--ssz-text-secondary)"
                          style={{ textWrap: 'pretty' }}
                        >
                          {c.levels[level]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
                        {[0, 1, 2].map((d) => (
                          <i
                            key={d}
                            className="block size-2 rounded-full"
                            style={{
                              background:
                                d < level ? 'var(--ssz-color-primary-500)' : 'var(--ssz-bg-muted)',
                            }}
                          />
                        ))}
                      </span>
                      <span
                        className="text-xs tabular-nums text-(--ssz-text-muted)"
                        style={{ fontFamily: RA_MONO }}
                      >
                        {t('graded.mark', { mark: level })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {decision?.comment !== undefined && decision.comment.trim() !== '' && (
              <p className="m-0 text-sm text-(--ssz-text-secondary)">{decision.comment}</p>
            )}
          </section>
        );
      })}

      {comment !== null && comment.trim() !== '' && (
        <p className="m-0 text-sm text-(--ssz-text-secondary)">{comment}</p>
      )}

      {showModel === 'afterGraded' && onPlayModel !== undefined && (
        <button
          type="button"
          onClick={onPlayModel}
          disabled={!interactive}
          className={`inline-flex items-center gap-1.5 self-start rounded-(--ssz-radius-sm) border px-3 py-1.5 text-xs font-medium ${RA_FOCUS}`}
          style={{
            background: 'var(--ssz-bg-surface)',
            borderColor: 'var(--ssz-border-strong)',
            color: 'var(--ssz-text-primary)',
          }}
        >
          <Play size={13} aria-hidden="true" />
          {t('graded.model')}
        </button>
      )}

      {outcome === 'rewrite' && onRedo !== undefined && (
        <button
          type="button"
          onClick={onRedo}
          disabled={!interactive}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-(--ssz-radius-sm) p-3 text-sm font-semibold text-white ${RA_FOCUS}`}
          style={{ background: 'var(--ssz-color-primary-500)' }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t('graded.redo')}
        </button>
      )}
    </div>
  );
}
