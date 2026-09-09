'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { passes } from '@/lib/shared-kernel/sentence-schema';

import { AudioTranscriptCard } from '../audio';
import { setChunkNote, setWhy, type SentenceSchemaDocument } from './edits';

export interface StepFeedbackProps {
  exercise: SentenceSchemaDocument;
  onChange: (next: SentenceSchemaDocument) => void;
}

/**
 * Step 4: why the sentence is built the way it is.
 *
 * The step this whole plan exists for. The audit's standing complaint about this type was
 * that it could tell a student they were wrong and never tell them *what* was wrong — "the
 * verb is not in second place" was not a sentence the exercise could say. `row.why` is
 * that sentence, and it is a blocker rather than a nicety because an exercise that marks
 * without explaining is a test, and this is not a test.
 *
 * It is shown twice: under a correct answer, and as the escalating hint from the second
 * mistake. So it has to read as an explanation of the structure and not as praise — which
 * is what the placeholder is for.
 *
 * The chunk notes are the exception, not the routine. One per chunk, shown instead of the
 * default when that piece lands in the wrong field, and worth writing only where the
 * sentence-level rule genuinely does not cover it.
 */
export function StepFeedback({ exercise, onChange }: StepFeedbackProps) {
  const t = useTranslations('Authoring');
  const [open, setOpen] = useState<string | null>(null);

  const written = exercise.rows.filter((row) => row.why.trim() !== '').length;
  const total = exercise.rows.length;
  const notes = passes(exercise).chunkNotes;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('sentenceSchema.step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('sentenceSchema.step4.lede')}</p>
      </div>

      {exercise.audio.audio.enabled && (
        <AudioTranscriptCard
          draft={exercise.audio}
          onChange={(audio) => onChange({ ...exercise, audio })}
        />
      )}

      <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <p className="text-2xl font-semibold tabular-nums">
          {written}
          <span className="text-base text-muted-foreground"> / {total}</span>
        </p>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
            <div
              className="h-full rounded-full bg-(--ssz-color-primary-600)"
              style={{ width: `${total === 0 ? 0 : Math.round((100 * written) / total)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('sentenceSchema.step4.coverage')} ·{' '}
            {t('sentenceSchema.step4.notes', { count: notes })}
          </p>
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {exercise.rows.map((row, index) => {
          const missing = row.why.trim() === '';
          const expanded = open === row.id;

          return (
            <li
              key={row.id}
              className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 ${
                missing ? 'border-error' : 'border-border'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)">
                  {index + 1}
                </span>
                <span className="min-w-0 truncate text-sm">
                  {row.text.trim() === '' ? (
                    <em className="text-muted-foreground">
                      {t('sentenceSchema.step4.emptySentence')}
                    </em>
                  ) : (
                    row.text
                  )}
                </span>
                <span className="grow" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : row.id)}
                >
                  {t('sentenceSchema.step4.chunkNotes')}
                  {expanded ? (
                    <ChevronUp className="size-4" aria-hidden />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden />
                  )}
                </Button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" htmlFor={`ss-why-${row.id}`}>
                  {t('sentenceSchema.step4.whyLabel')}
                </label>
                <Textarea
                  id={`ss-why-${row.id}`}
                  rows={2}
                  value={row.why}
                  placeholder={t('sentenceSchema.step4.whyPlaceholder')}
                  onChange={(event) => onChange(setWhy(exercise, row.id, event.target.value))}
                />
                {missing && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
                    <AlertCircle className="size-3.5" aria-hidden />
                    {t('sentenceSchema.step4.whyRequired')}
                  </p>
                )}
              </div>

              {expanded &&
                (row.chunks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('sentenceSchema.step4.noChunks')}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {row.chunks.map((chunk) => (
                      <li key={chunk.id} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-xs">{chunk.text}</span>
                        <Input
                          className="flex-1"
                          value={row.fb[chunk.id] ?? ''}
                          placeholder={t('sentenceSchema.step4.notePlaceholder')}
                          aria-label={t('sentenceSchema.step4.notePlaceholder')}
                          onChange={(event) =>
                            onChange(setChunkNote(exercise, row.id, chunk.id, event.target.value))
                          }
                        />
                        <span
                          aria-hidden
                          className={`size-2 shrink-0 rounded-full ${
                            (row.fb[chunk.id] ?? '').trim() === ''
                              ? 'bg-(--ssz-bg-muted)'
                              : 'bg-success-500'
                          }`}
                        />
                        {(row.fb[chunk.id] ?? '').trim() !== '' && (
                          <span className="sr-only">{t('sentenceSchema.step4.noteWritten')}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
