'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';

import { Segmented } from '@/components/ui/segmented';
import type { WritingTaskDetails } from '@/features/content-authoring/types/review';
import { scoreRubric, type RubricSnapshot } from '@/lib/shared-kernel/writing-task';

const MARKS = ['0', '1', '2', '3'] as const;

export interface RubricMarksProps {
  /** The rubric frozen when the work was queued — never the exercise's rubric today. */
  snapshot: RubricSnapshot;
  /** What the reviewer has set so far. An absent key is a criterion nobody has marked. */
  marks: Record<string, number>;
  /** The engine's measurements of the text; null when it could not read them. */
  details: WritingTaskDetails | null;
  /** False once a verdict stands — the marks become a record of what was decided. */
  editable: boolean;
  onMark: (criterionId: string, mark: number) => void;
}

/**
 * The rubric a free text is marked by: the facts, then one row per criterion.
 *
 * Every mark starts unset, and there is no "suggest" button. `analyse()` can produce
 * suggestions and the queue deliberately does not carry them (plan 50 §4): a rubric that
 * arrives pre-filled is a rubric a tired teacher confirms, and the four judgements it
 * holds are the only thing standing between two teachers marking the same text four
 * points apart. When the AI stage is built, what it fills in will be labelled as its
 * suggestion — which is a different screen from this one, not a default on it.
 *
 * The facts above the rows are measurements and nothing else. Words, paragraphs, and
 * which must-cover points were phrased — none of them is a mark and none of them moves
 * the score. They are there because a teacher deciding whether the task was answered
 * should not have to count the points themselves.
 *
 * The running score is shown as it is set rather than only at the end, because the
 * threshold is what turns marks into a verdict: a teacher who sets three marks and sees
 * the total sitting one point under the pass line knows exactly what the fourth decides.
 */
export function RubricMarks({ snapshot, marks, details, editable, onMark }: RubricMarksProps) {
  const t = useTranslations('Review.rubric');
  const outcome = scoreRubric(snapshot, marks);

  return (
    <section className="flex flex-col gap-3">
      {details === null ? null : <Facts details={details} />}

      {/* A native fieldset rather than a styling trick: once a verdict stands the marks
          are a record, and a control that merely looked inert would still take the
          keyboard. */}
      <fieldset className="flex flex-col gap-2" disabled={!editable}>
        {snapshot.criteria.map((criterion) => {
          const mark = marks[criterion.id];
          const set = mark !== undefined;

          return (
            <div
              key={criterion.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border-[1.5px] border-border px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">
                  {criterion.name.trim() === '' ? t('unnamed') : criterion.name}
                  {criterion.weight === 2 && (
                    <span className="ml-1.5 text-[11px] font-bold text-muted-foreground">
                      {t('weight')}
                    </span>
                  )}
                </p>
                {/* The descriptor of the mark being given, not the criterion's blurb: it
                    is the sentence that has to be true of this text for this mark, and it
                    is what makes two teachers agree. Before a mark is set there is no
                    descriptor to show, so the criterion says what it is about instead. */}
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {set ? criterion.levels[mark]?.trim() || '—' : criterion.desc || t('unmarked')}
                </p>
              </div>

              {/* No value at all until a mark is set — an unmarked criterion must not
                  look like a zero, which is a judgement nobody made. */}
              <Segmented<string>
                size="sm"
                aria-label={t('markOf', {
                  name: criterion.name.trim() === '' ? t('unnamed') : criterion.name,
                })}
                value={set ? String(mark) : ''}
                onValueChange={(value) => onMark(criterion.id, Number(value))}
                options={MARKS.map((value) => ({ value, label: value }))}
              />
            </div>
          );
        })}
      </fieldset>

      <p className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
        <span className="font-bold tabular-nums">
          {t('score', { points: outcome.points, max: outcome.max })}
        </span>
        <span className="text-muted-foreground">
          {t('threshold', { passScore: snapshot.passScore })}
        </span>
        {!outcome.complete && (
          <span className="text-muted-foreground">
            {t('remaining', { count: outcome.missing.length })}
          </span>
        )}
      </p>
    </section>
  );
}

/**
 * What the machine measured, stated once above the marking.
 *
 * The point chips carry two facts that are allowed to disagree: `hit` is the author's
 * keywords matching somewhere in the text, `ticked` is the learner saying they covered
 * it. A point ticked but not hit is the interesting one — either the learner phrased it
 * another way, or the keywords match nobody — and it is named as such rather than drawn
 * as a failure, because it is not evidence of anything on its own.
 */
function Facts({ details }: { details: WritingTaskDetails }) {
  const t = useTranslations('Review.rubric');

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-muted-foreground">
        {t('facts', {
          words: details.wordCount,
          paragraphs: details.paragraphs,
          hit: details.hitCount,
          needed: details.neededCount,
        })}
        {details.length === 'short' && ` · ${t('tooShort')}`}
        {details.length === 'long' && ` · ${t('tooLong')}`}
      </p>

      {details.points.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {details.points.map((point) => (
            <li
              key={point.id}
              title={point.ticked && !point.hit ? t('tickedNotHit') : undefined}
              className={`inline-flex items-center gap-1 rounded-[9px] border-[1.5px] px-2 py-1 text-[11.5px] font-semibold ${
                point.hit
                  ? 'border-transparent bg-success-100 text-success-700'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {point.hit ? (
                <Check className="size-3" aria-hidden />
              ) : (
                <X className="size-3" aria-hidden />
              )}
              {point.text.trim() === '' ? t('unnamedPoint') : point.text}
              {point.ticked && !point.hit && <span aria-hidden>·</span>}
              {point.ticked && !point.hit && (
                <span className="font-normal">{t('tickedShort')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
