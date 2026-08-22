'use client';

import { useTranslations } from 'next-intl';

import { DiffLegend } from '@/features/content-authoring/components/translate/tr-marks';
import type { ReviewDetails } from '@/features/content-authoring/types/review';

import { readWritingTaskDetails } from '../../lib/writing-task-details';
import type { ReviewSubmission } from '../../types';

import { RubricMarks } from './rubric-marks';
import { isTranslateDetail, SentenceRow } from './sentence-row';

const READING = 'var(--ssz-font-reading)';

export interface SentenceListProps {
  submission: ReviewSubmission;
  /** Comments on single sentences, by item id — owned by the panel, saved with the verdict. */
  comments: Record<string, string>;
  onComment: (itemId: string, value: string | undefined) => void;
  /** Rubric marks so far, by criterion id — `writing_task` only. Owned by the panel. */
  marks: Record<string, number>;
  onMark: (criterionId: string, mark: number) => void;
  /** False once a verdict stands: the rubric becomes a record of what was decided. */
  editable: boolean;
}

/**
 * The work itself, in whichever shape its template hands it over.
 *
 * An essay is one block of prose and has no sentences to analyse; a translation set is a
 * list of them, most of which the machine has already closed. Both are drawn here rather
 * than by two screens, because what a teacher does at the end of either is identical — and
 * a `writing_task` that rendered the empty slots of a diff it never produces would look
 * like a screen that had failed (criterion 22).
 *
 * The line above the list is the one number that decides how much reading is left: how
 * many sentences matched the key word for word. It is stated before the list rather than
 * discovered by scrolling it.
 */
export function SentenceList({
  submission,
  comments,
  onComment,
  marks,
  onMark,
  editable,
}: SentenceListProps) {
  const t = useTranslations('Review.submission');

  if (submission.exercise.type === 'writing_task') {
    return (
      <div className="flex flex-col gap-4">
        <EssayBody text={submission.text} />
        {/* No rubric is not a broken screen. A submission queued before the rubric
            existed, or one whose author left it empty, is marked the old way with the
            verdict buttons — and the panel below is already that screen. Tested for
            truthiness rather than against `null`: this arrives over the wire, and an
            older BFF that omits the field would otherwise crash the row. */}
        {!submission.rubric ? null : (
          <RubricMarks
            snapshot={submission.rubric}
            marks={submission.rubricMarks ?? marks}
            details={readWritingTaskDetails(submission.details)}
            editable={editable}
            onMark={onMark}
          />
        )}
      </div>
    );
  }

  // Everything below reads a per-item breakdown, which the branch above is the only
  // template without — so by here the union has one member left.
  const details = submission.details as ReviewDetails | null;
  if (details === null) {
    // The banner above has already said why there is no analysis; what is owed here is the
    // answer as it was handed in, so the verdict can still be given on something.
    return <RawAnswer answer={submission.submittedAnswer} />;
  }

  const items = details.items;
  if (items.length === 0) return <RawAnswer answer={submission.submittedAnswer} />;

  const closed = items.filter((item) => item.routing === 'pass').length;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12.5px] text-muted-foreground">
          {t('closedVerbatim', { closed, total: items.length })}
        </p>
        {items.some(isTranslateDetail) ? <DiffLegend /> : null}
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item, position) => (
          <SentenceRow
            key={item.itemId}
            detail={item}
            index={position + 1}
            prompt={item.prompt ?? undefined}
            teacherNote={item.note ?? undefined}
            comment={comments[item.itemId]}
            onComment={(value) => onComment(item.itemId, value)}
          />
        ))}
      </ul>
    </section>
  );
}

/** `writing_task`: the prose, and the one measure of it that is not a judgement. */
function EssayBody({ text }: { text: string | null }) {
  const t = useTranslations('Review.submission');
  const words = text === null ? 0 : text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <section className="flex flex-col gap-2">
      <p className="text-[12.5px] text-muted-foreground">{t('essay', { words })}</p>
      <p
        className="whitespace-pre-wrap rounded-[11px] border-[1.5px] border-border px-4 py-3"
        style={{ fontFamily: READING, fontSize: 15.5, lineHeight: 1.75 }}
      >
        {text === null || text.trim() === '' ? t('sentence.blank') : text}
      </p>
    </section>
  );
}

/**
 * The submission with nothing said about it — the fallback when no analysis exists.
 *
 * Rendered as the plain strings the answer carries rather than as its JSON: a teacher
 * being asked to decide should be reading Norwegian, not a payload. Anything that is not
 * a string is dropped, since it is structure the analysis would have made sense of.
 */
function RawAnswer({ answer }: { answer: unknown }) {
  const t = useTranslations('Review.submission');
  const lines = plainStrings(answer);

  if (lines.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{t('sentence.blank')}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((line, position) => (
        <li
          key={position}
          className="rounded-[9px] border border-border px-3 py-2 text-[14.5px] leading-relaxed"
          style={{ fontFamily: READING }}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function plainStrings(value: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (typeof value === 'string') return value.trim() === '' ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((entry) => plainStrings(entry, depth + 1));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((entry) => plainStrings(entry, depth + 1));
  }
  return [];
}
