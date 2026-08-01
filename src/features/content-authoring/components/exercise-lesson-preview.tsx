'use client';

import { useTranslations } from 'next-intl';

import type { ExerciseFormValues } from '../schemas/exercise';

interface ExerciseLessonPreviewProps {
  title: string;
  values: ExerciseFormValues;
}

/** Live "exactly what the learner sees" preview for an EXERCISE lesson, rendered inside `PhoneFrame`. */
export function ExerciseLessonPreview({ title, values }: ExerciseLessonPreviewProps) {
  const t = useTranslations('Authoring');

  const empty = <p className="italic text-muted-foreground">{t('lessons.previewEmpty')}</p>;

  return (
    <div>
      <div className="border-b border-(--ssz-border-default) bg-surface px-4 pb-3 pt-4">
        <div className="text-[17px] font-bold tracking-tight text-(--ssz-text-primary)">
          {title || t('lessons.untitled')}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {t(`exercises.types.${values.templateCode}`)}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {values.templateCode === 'multiple_choice' &&
          (values.mcQuestion ? (
            <div>
              <p className="mb-3.5 text-[15px] font-semibold leading-normal text-(--ssz-text-primary)">
                {values.mcQuestion}
              </p>
              <div className="flex flex-col gap-2">
                {(values.mcOptions ?? [])
                  .filter((o) => o.text.trim())
                  .map((option, i) => (
                    <div
                      key={i}
                      className={
                        i === values.mcCorrectIndex
                          ? 'rounded-[11px] border border-success-500 bg-success-50 px-3.5 py-3 text-sm font-medium text-(--ssz-text-primary)'
                          : 'rounded-[11px] border border-(--ssz-border-default) bg-surface px-3.5 py-3 text-sm font-medium text-(--ssz-text-primary)'
                      }
                    >
                      {option.text}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            empty
          ))}

        {values.templateCode === 'fill_in_blank' &&
          (values.fibText ? (
            <div className="space-y-2">
              <p className="font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)">
                {values.fibText}
              </p>
              {/* The matrix itself is post-check feedback, so the preview only
                  notes that one is attached rather than reproducing it. */}
              {(values.fibBlanks ?? []).some(
                (b) =>
                  b.rationaleExplanation?.trim() ||
                  (b.rationaleOptions ?? []).some((o) => o.text.trim()),
              ) && (
                <p className="text-xs text-muted-foreground">
                  {t('exercises.fibRationaleAttached')}
                </p>
              )}
            </div>
          ) : (
            empty
          ))}

        {(values.templateCode === 'translate_to_target' ||
          values.templateCode === 'translate_from_target') &&
          (values.trSourceText ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {t(`exercises.types.${values.templateCode}`)}
              </p>
              <p className="font-reading text-[16px] leading-normal text-(--ssz-text-primary)">
                {values.trSourceText}
              </p>
            </div>
          ) : (
            empty
          ))}

        {values.templateCode === 'match_pairs' &&
          ((values.mpPairs ?? []).some((p) => p.left.trim() || p.right.trim()) ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                {(values.mpPairs ?? [])
                  .filter((p) => p.left.trim())
                  .map((p, i) => (
                    <div
                      key={i}
                      className="rounded-[11px] border border-(--ssz-border-default) bg-surface px-3 py-2.5 text-sm text-(--ssz-text-primary)"
                    >
                      {p.left}
                    </div>
                  ))}
              </div>
              <div className="flex flex-col gap-2">
                {(values.mpPairs ?? [])
                  .filter((p) => p.right.trim())
                  .map((p, i) => (
                    <div
                      key={i}
                      className="rounded-[11px] border border-dashed border-(--ssz-border-default) bg-subtle px-3 py-2.5 text-sm text-(--ssz-text-primary)"
                    >
                      {p.right}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            empty
          ))}

        {values.templateCode === 'short_answer' &&
          (values.saQuestion ? (
            <div>
              <p className="mb-2.5 text-[15px] font-semibold leading-normal text-(--ssz-text-primary)">
                {values.saQuestion}
              </p>
              {values.saContext && (
                <p className="mb-2.5 text-xs text-muted-foreground">{values.saContext}</p>
              )}
              <div className="rounded-[11px] border border-dashed border-(--ssz-border-default) bg-subtle px-3 py-3 text-sm text-muted-foreground">
                {t('exercises.saAnswerPlaceholderPreview')}
              </div>
            </div>
          ) : (
            empty
          ))}

        {values.templateCode === 'writing_task' &&
          (values.wtPrompt ? (
            <div>
              <p className="mb-2.5 text-[15px] font-semibold leading-normal text-(--ssz-text-primary)">
                {values.wtPrompt}
              </p>
              {(values.wtTopics ?? []).some((tp) => tp.title.trim()) && (
                <div className="flex flex-col gap-2">
                  {(values.wtTopics ?? [])
                    .filter((tp) => tp.title.trim())
                    .map((tp, i) => (
                      <div
                        key={i}
                        className="rounded-[11px] border border-(--ssz-border-default) bg-surface px-3.5 py-3 text-sm font-medium text-(--ssz-text-primary)"
                      >
                        {tp.title}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            empty
          ))}

        {values.templateCode === 'sentence_schema' &&
          (values.ssSentence ? (
            <div>
              <p className="mb-2.5 text-[15px] font-semibold leading-normal text-(--ssz-text-primary)">
                {values.ssSentence}
              </p>
              <div className="mb-3 overflow-x-auto">
                <div className="flex min-w-max gap-1.5">
                  {(values.ssFields ?? [])
                    .filter((f) => f.label.trim())
                    .map((f, i) => (
                      <div
                        key={i}
                        className="min-w-20 flex-1 rounded-md border border-dashed border-(--ssz-border-default) bg-subtle px-2 py-2 text-center"
                      >
                        <p className="text-[11px] font-medium text-muted-foreground">{f.label}</p>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(values.ssTokens ?? [])
                  .filter((tk) => tk.text.trim())
                  .map((tk, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-(--ssz-border-default) bg-surface px-3 py-1 text-sm text-(--ssz-text-primary)"
                    >
                      {tk.text}
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            empty
          ))}

        {values.templateCode === 'word_bank_fill' &&
          ((values.wbfSentences ?? []).some((s) => s.text.trim()) ? (
            <div>
              <div className="mb-3 flex flex-wrap gap-1.5 rounded-[11px] border border-(--ssz-border-default) px-3 py-2.5">
                {values.wbfWordBank
                  ?.split(',')
                  .map((w) => w.trim())
                  .filter(Boolean)
                  .map((word, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-subtle px-2 py-0.5 text-[13px] text-secondary-foreground"
                    >
                      {word}
                    </span>
                  ))}
              </div>
              <ol className="flex flex-col gap-2">
                {(values.wbfSentences ?? [])
                  .filter((s) => s.text.trim())
                  .map((sentence, i) => (
                    <li
                      key={i}
                      className="font-reading text-[14.5px] leading-loose text-(--ssz-text-primary)"
                    >
                      {/* Blanks show as a dropdown-ish slot, matching the runner. */}
                      {i + 1}. {sentence.text.replace(/___\d+___/g, '［ … ］')}
                    </li>
                  ))}
              </ol>
            </div>
          ) : (
            empty
          ))}

        {values.instructions && (
          <p className="mt-3.5 text-xs text-muted-foreground">{values.instructions}</p>
        )}
      </div>
    </div>
  );
}
