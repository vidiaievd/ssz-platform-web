'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  cellKey,
  cellOf,
  packOf,
  slotsInPlay,
  type InflectionTableContent,
} from '@/lib/shared-kernel/inflection-table';

import { ChipEditor } from '../chip-editor';
import { Callout, EmptyState, StepHead } from '../highlight-in-text/parts';
import { addAccept, removeAccept, setWhy } from './edits';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

export interface StepReasonsProps<T extends InflectionTableContent> {
  exercise: T;
  onChange: (next: T) => void;
  onGoToStep: (step: number) => void;
}

/**
 * Step 3: why this form and not that one (plan 69 §7.4).
 *
 * One card per row that asks anything, one block per asked cell: the reason the student reads
 * instead of «wrong», and the variants accepted in this cell only. A cell with a key and no
 * reason is a blocker (DECISIONS §3) — its block is red and its field `aria-invalid`, and the
 * rail, the gate and the preflight say the same thing from the same list (IT-B8).
 */
export function StepReasons<T extends InflectionTableContent>({
  exercise,
  onChange,
  onGoToStep,
}: StepReasonsProps<T>) {
  const t = useTranslations('Authoring.inflectionTable.step3');
  const pack = packOf(exercise);
  const slots = slotsInPlay(exercise);

  const asked = (row: InflectionTableContent['rows'][number]) =>
    slots.filter((slot) => cellOf(row, slot.id).mode === 'ask');
  const rows = exercise.rows
    .map((row, index) => ({ row, index, slots: asked(row) }))
    .filter((entry) => entry.slots.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      {rows.length === 0 && (
        <EmptyState
          icon={FileText}
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <Button type="button" variant="outline" onClick={() => onGoToStep(2)}>
              {t('backToGrid')}
            </Button>
          }
        />
      )}

      {rows.map(({ row, index, slots: askedSlots }) => (
        <section
          key={row.id}
          aria-labelledby={`it-why-${row.id}`}
          className="rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface)"
          style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
        >
          <div className="flex items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-3 pl-3">
            <span
              aria-hidden="true"
              className="grid size-5 place-items-center rounded-full bg-(--ssz-bg-muted) text-[11px] font-semibold"
            >
              {index + 1}
            </span>
            <h3
              id={`it-why-${row.id}`}
              className="m-0 text-base font-semibold"
              style={READING}
              lang={exercise.language}
            >
              {row.lemma.trim() === '' ? '—' : row.lemma}
            </h3>
            <span className="text-xs text-(--ssz-text-muted)">{row.gloss}</span>
            <span className="flex-1" />
            <span className="text-xs text-(--ssz-text-muted)">
              {t('rowAsked', { count: askedSlots.length })}
            </span>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {askedSlots.map((slot) => {
              const cell = cellOf(row, slot.id);
              const missing = cell.why.trim() === '';
              const name = { lemma: row.lemma, slot: slot.label };
              return (
                <div
                  key={slot.id}
                  data-bad={missing ? 'true' : undefined}
                  className={`flex flex-col gap-2 rounded-(--ssz-radius-sm) border px-3 py-[11px] ${
                    missing
                      ? 'border-(--ssz-color-error-300) bg-(--ssz-color-error-50)'
                      : 'border-(--ssz-border-default) bg-(--ssz-bg-base)'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-[4px] bg-(--ssz-color-primary-100) px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-(--ssz-color-primary-700) uppercase">
                      {slot.short}
                    </span>
                    {cell.value.trim() === '' ? (
                      <em className="text-(--ssz-color-error-700)">{t('noKey')}</em>
                    ) : (
                      <b style={READING} lang={exercise.language}>
                        {cell.value}
                      </b>
                    )}
                    <span className="flex-1" />
                    <span className="font-mono text-[10px] text-(--ssz-text-muted)">
                      {cellKey(row.id, slot.id)}
                    </span>
                  </div>

                  <Textarea
                    rows={2}
                    aria-label={t('reasonLabel', name)}
                    aria-invalid={missing}
                    value={cell.why}
                    placeholder={pack?.demo.why ?? t('reasonFallback')}
                    onChange={(e) => onChange(setWhy(exercise, row.id, slot.id, e.target.value))}
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-(--ssz-text-muted)">{t('alsoAccept')}</span>
                    <ChipEditor
                      values={cell.accept}
                      placeholder={t('variantPlaceholder')}
                      label={t('variantLabel', name)}
                      removeLabel={(value) => t('removeVariant', { value })}
                      onAdd={(value) => onChange(addAccept(exercise, row.id, slot.id, value))}
                      onRemove={(value) =>
                        onChange(
                          removeAccept(exercise, row.id, slot.id, cell.accept.indexOf(value)),
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {rows.length > 0 && (
        <Callout tone="warn">
          {pack === null
            ? t('warnPlain')
            : t.rich('warn', {
                asked: pack.demo.asked,
                wrote: pack.demo.wrote,
                r: (chunks) => (
                  <span style={READING} lang={exercise.language}>
                    {chunks}
                  </span>
                ),
              })}
        </Callout>
      )}
    </div>
  );
}
