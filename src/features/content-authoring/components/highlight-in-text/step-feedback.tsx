'use client';

import { useState } from 'react';
import { Check, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  coverage,
  spanOrdinals,
  type HighlightInTextContent,
} from '@/lib/shared-kernel/highlight-in-text';

import { setQuestion, setSpanWhy } from './edits';
import { Bar, Card, Field, StepHead } from './parts';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;
const MONO = { fontFamily: 'var(--ssz-font-mono)' } as const;

export interface StepFeedbackProps<T extends HighlightInTextContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/**
 * Step 3: what the verdict says (plan 67 §7.5, BEHAVIOR §4).
 *
 * A marking exercise fails in two directions and each gets its own words: the missed-mark
 * line (required on a question with marks — `HT_NO_MISS_HINT`, AC-A5) and the extra-mark line,
 * where the traps of the text are named. The per-mark reasons are the same `why` fields as the
 * key list in step 2, gathered here per question for writing in one sitting.
 *
 * «Only what is still empty» narrows the page to the questions and reasons still blank.
 */
export function StepFeedback<T extends HighlightInTextContent>({
  exercise,
  onChange,
}: StepFeedbackProps<T>) {
  const t = useTranslations('Authoring.highlightInText.step3');
  const [only, setOnly] = useState(false);

  const cov = coverage(exercise);
  const missing = cov.total - cov.written;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <div className="flex items-center gap-5 rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface) p-4">
        <div>
          <div
            className="text-2xl font-bold tracking-tight"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {cov.written}
            <i className="text-sm font-medium text-(--ssz-text-muted) not-italic"> / {cov.total}</i>
          </div>
          <p className="m-0 text-xs text-(--ssz-text-muted)">{t('coverage.label')}</p>
        </div>
        <div className="min-w-0 flex-1">
          <Bar
            value={cov.total === 0 ? 0 : (cov.written / cov.total) * 100}
            label={t('coverage.label')}
          />
          <p
            className="m-0 mt-2 flex items-start gap-[5px] text-xs"
            style={{
              color: missing > 0 ? 'var(--ssz-text-muted)' : 'var(--ssz-color-success-700)',
            }}
          >
            {missing > 0 ? (
              <Info size={13} aria-hidden="true" className="mt-px shrink-0" />
            ) : (
              <Check size={13} aria-hidden="true" className="mt-px shrink-0" />
            )}
            {missing > 0 ? t('coverage.missing', { count: missing }) : t('coverage.done')}
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-[7px] text-xs text-(--ssz-text-secondary)">
        <Checkbox checked={only} onCheckedChange={(on) => setOnly(on === true)} />
        {t('onlyEmpty')}
      </label>

      {exercise.questions.map((q, index) => {
        if (only && !hasBlank(q)) return null;

        const ordinals = spanOrdinals(q);
        const spans = [...q.spans]
          .sort((a, b) => a.start - b.start)
          .filter((s) => !only || s.why.trim() === '');
        const missEmpty = q.missHint.trim() === '';
        const id = (part: string) => `ht-${q.id}-${part}`;

        return (
          <section
            key={q.id}
            aria-labelledby={id('title')}
            className="rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface)"
            style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
          >
            <div className="flex items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-2 pl-3">
              <span
                aria-hidden="true"
                className="grid size-[22px] shrink-0 place-items-center rounded-(--ssz-radius-sm) bg-(--ssz-bg-subtle) text-[11px] font-bold text-(--ssz-text-secondary)"
                style={MONO}
              >
                {index + 1}
              </span>
              <h3 id={id('title')} className="m-0 truncate text-sm font-semibold">
                {q.prompt.trim() || t('untitled')}
              </h3>
              <span className="flex-1" />
              <span className="shrink-0 text-xs text-(--ssz-text-muted)">
                {t('marks', { count: q.spans.length })}
              </span>
            </div>

            <div className="flex flex-col gap-3 p-4">
              <Field
                label={t('missLabel')}
                htmlFor={id('miss')}
                required
                message={
                  missEmpty && q.spans.length > 0
                    ? { tone: 'error', text: t('missRequired'), id: id('miss-msg') }
                    : { tone: 'hint', text: t('missHelp'), id: id('miss-msg') }
                }
              >
                <Textarea
                  id={id('miss')}
                  rows={2}
                  aria-describedby={id('miss-msg')}
                  aria-invalid={missEmpty && q.spans.length > 0}
                  value={q.missHint}
                  placeholder={t('missPlaceholder')}
                  onChange={(event) =>
                    onChange(setQuestion(exercise, q.id, { missHint: event.target.value }))
                  }
                />
              </Field>

              <Field
                label={t('fpLabel')}
                htmlFor={id('fp')}
                message={{ tone: 'hint', text: t('fpHelp'), id: id('fp-msg') }}
              >
                <Textarea
                  id={id('fp')}
                  rows={2}
                  aria-describedby={id('fp-msg')}
                  value={q.fpHint}
                  placeholder={t('fpPlaceholder')}
                  onChange={(event) =>
                    onChange(setQuestion(exercise, q.id, { fpHint: event.target.value }))
                  }
                />
              </Field>

              {spans.length > 0 && (
                <Field
                  label={t('reasonsLabel')}
                  message={{ tone: 'hint', text: t('reasonsHelp'), id: id('reasons-msg') }}
                >
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {spans.map((s) => {
                      const n = ordinals.get(s.id) ?? 0;
                      const surface = exercise.text.slice(s.start, s.end);
                      return (
                        <li
                          key={s.id}
                          className="grid grid-cols-[22px_minmax(120px,1.1fr)_minmax(0,2fr)] items-center gap-[9px] rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface) px-2.5 py-[7px] max-[820px]:grid-cols-[22px_minmax(0,1fr)]"
                        >
                          <span
                            aria-hidden="true"
                            className="grid size-[22px] place-items-center rounded-(--ssz-radius-sm) bg-(--ssz-bg-subtle) text-[11px] font-bold text-(--ssz-text-secondary)"
                            style={MONO}
                          >
                            {n}
                          </span>
                          <b className="truncate text-base font-semibold" style={READING}>
                            {surface}
                          </b>
                          <Input
                            className="border-transparent bg-transparent px-2 py-1.5 text-sm focus:bg-(--ssz-bg-surface) max-[820px]:col-span-full"
                            aria-label={t('reasonLabel', { n, surface })}
                            placeholder="—"
                            value={s.why}
                            onChange={(event) =>
                              onChange(setSpanWhy(exercise, q.id, s.id, event.target.value))
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </Field>
              )}
            </div>
          </section>
        );
      })}

      {only && exercise.questions.every((q) => !hasBlank(q)) && (
        <Card>
          <p className="m-0 text-sm text-(--ssz-text-secondary)">{t('allWritten')}</p>
        </Card>
      )}
    </div>
  );
}

function hasBlank(q: HighlightInTextContent['questions'][number]): boolean {
  return (
    q.missHint.trim() === '' || q.fpHint.trim() === '' || q.spans.some((s) => s.why.trim() === '')
  );
}
