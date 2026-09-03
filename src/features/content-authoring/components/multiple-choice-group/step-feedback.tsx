'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

import { Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  column,
  coverage,
  quoteFound,
  readyRows,
  type Row,
  type ShowWhy,
} from '@/lib/shared-kernel/multiple-choice-group';

import { AudioTranscriptCard } from '../audio';
import { setRow, setSettings, type MultipleChoiceGroupDocument } from './edits';

export interface StepFeedbackProps {
  exercise: MultipleChoiceGroupDocument;
  onChange: (next: MultipleChoiceGroupDocument) => void;
}

/**
 * Step 4: why each answer is what it is.
 *
 * The step the type exists for. A Riktig/Galt table that only ever says «feil» teaches a
 * student that they guessed wrong; a table that says *where in the text it is settled*
 * teaches them to read. Two fields carry that, and they are not the same field twice:
 *
 *   * **the line** — the author's own sentence, shown under the row after a check;
 *   * **the quote** — the words of the passage that prove it, offered only where the
 *     passage is actually attached (S4.8), because a quote from a text the student cannot
 *     see is a citation of nothing.
 *
 * Only *finished* statements get a card, in the author's order and never the shuffled one
 * (S4.11). A row with no text or no marked answer does not reach a student, so a field to
 * explain it would be a field nobody will read.
 */
export function StepFeedback({ exercise, onChange }: StepFeedbackProps) {
  const t = useTranslations('Authoring');

  const s = exercise.settings;
  const cov = coverage(exercise);
  const ready = readyRows(exercise);
  const percent = cov.total === 0 ? 0 : Math.round((100 * cov.written) / cov.total);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('multipleChoiceGroup.step4.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('multipleChoiceGroup.step4.lede')}</p>
      </div>

      {exercise.audio.audio.enabled && (
        <AudioTranscriptCard
          draft={exercise.audio}
          onChange={(audio) => onChange({ ...exercise, audio })}
        />
      )}

      <section className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4">
        <span className="text-xs font-medium">{t('multipleChoiceGroup.step4.showWhyLabel')}</span>
        <Segmented<ShowWhy>
          value={s.showWhy}
          aria-label={t('multipleChoiceGroup.step4.showWhyLabel')}
          onValueChange={(showWhy) => onChange(setSettings(exercise, { showWhy }))}
          options={[
            { value: 'never', label: t('multipleChoiceGroup.step4.showWhyNever') },
            { value: 'wrong', label: t('multipleChoiceGroup.step4.showWhyWrong') },
            { value: 'always', label: t('multipleChoiceGroup.step4.showWhyAlways') },
          ]}
          className="self-start"
        />
      </section>

      <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <p className="text-2xl font-semibold tabular-nums">
          {cov.written}
          <span className="text-base text-muted-foreground"> / {cov.total}</span>
        </p>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-(--ssz-bg-muted)">
            <div
              className="h-full rounded-full bg-(--ssz-color-primary-600)"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('multipleChoiceGroup.step4.coverage')} ·{' '}
            {t('multipleChoiceGroup.step4.coverageQuoted', { count: cov.quoted })}
          </p>
        </div>
      </section>

      {ready.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t('multipleChoiceGroup.step4.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ready.map((row, index) => (
            <li key={row.id}>
              <FeedbackCard row={row} index={index} exercise={exercise} onChange={onChange} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One statement's line, and the words of the text behind it. */
function FeedbackCard({
  row,
  index,
  exercise,
  onChange,
}: {
  row: Row;
  index: number;
  exercise: MultipleChoiceGroupDocument;
  onChange: (next: MultipleChoiceGroupDocument) => void;
}) {
  const t = useTranslations('Authoring');

  const answer = column(exercise, row.answer);
  const required = exercise.settings.showWhy !== 'never';
  const missing = required && row.why.trim() === '';
  const inline = exercise.source.mode === 'inline';
  // Reported, never refused: IMPLEMENTATION.md is explicit that a teacher may edit the
  // passage after writing the quotes, and losing the quote would be worse than showing a
  // stale one. The check collapses whitespace, so a quote pasted out of a wrapped
  // paragraph is not flagged for its line breaks.
  const quoteMissing =
    inline && row.quote.trim() !== '' && !quoteFound(exercise.source.text, row.quote);

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 ${
        missing ? 'border-error' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-bold text-(--ssz-text-secondary)"
        >
          {index + 1}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-sm"
          style={{ fontFamily: 'var(--ssz-font-reading)' }}
        >
          {row.text}
        </span>
        <span className="shrink-0 rounded-full border border-success-500 bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
          {answer?.label.trim() === '' || answer === null
            ? t('multipleChoiceGroup.step2.unnamedColumn')
            : answer.label}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`mcg-why-${row.id}`}>
          {t('multipleChoiceGroup.step4.whyLabel')}
        </label>
        <Textarea
          id={`mcg-why-${row.id}`}
          aria-describedby={`mcg-why-help-${row.id}`}
          rows={2}
          value={row.why}
          hasError={missing}
          aria-invalid={missing}
          placeholder={
            answer === null || answer.label.trim() === ''
              ? t('multipleChoiceGroup.step4.whyPlaceholder')
              : t('multipleChoiceGroup.step4.whyPlaceholderKey', { label: answer.label })
          }
          onChange={(event) => onChange(setRow(exercise, row.id, { why: event.target.value }))}
        />
        <p
          id={`mcg-why-help-${row.id}`}
          className={`text-xs ${missing ? 'text-error' : 'text-muted-foreground'}`}
        >
          {missing
            ? t('multipleChoiceGroup.issues.ROW_NO_WHY')
            : t('multipleChoiceGroup.step4.whyHelp')}
        </p>
      </div>

      {inline && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" htmlFor={`mcg-quote-${row.id}`}>
            {t('multipleChoiceGroup.step4.quoteLabel')}
          </label>
          <Input
            id={`mcg-quote-${row.id}`}
            aria-describedby={`mcg-quote-help-${row.id}`}
            value={row.quote}
            style={{ fontFamily: 'var(--ssz-font-reading)' }}
            placeholder={t('multipleChoiceGroup.step4.quotePlaceholder')}
            onChange={(event) => onChange(setRow(exercise, row.id, { quote: event.target.value }))}
          />
          <p
            id={`mcg-quote-help-${row.id}`}
            className={`flex items-start gap-1.5 text-xs ${
              quoteMissing ? 'text-warning-700' : 'text-muted-foreground'
            }`}
          >
            {quoteMissing && <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            {quoteMissing
              ? t('multipleChoiceGroup.issues.QUOTE_NOT_IN_TEXT')
              : t('multipleChoiceGroup.step4.quoteHelp')}
          </p>
        </div>
      )}
    </div>
  );
}
