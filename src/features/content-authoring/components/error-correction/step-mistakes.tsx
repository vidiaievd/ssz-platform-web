'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  coverage,
  hasRef,
  spans,
  SPAN_TYPES,
  type ErrorCorrection,
  type Item,
  type Span,
} from '@/lib/shared-kernel/error-correction';

import {
  addItem,
  duplicateItem,
  emptyItem,
  parseAlts,
  removeItem,
  setItem,
  setSpanOverride,
} from './edits';

const READING = 'var(--ssz-font-reading)';

export interface StepMistakesProps {
  exercise: ErrorCorrection;
  onChange: (next: ErrorCorrection) => void;
}

/**
 * Step 2 of the error-correction builder: the two sentences per item, and the mistakes
 * the builder read out of them.
 *
 * The list of mistakes under each pair is the whole point of the screen. It is derived
 * on every keystroke and never stored, so what the author sees there is exactly what the
 * student will be marked against — an author who disagrees with the list has to change
 * the sentences, which is the honest way round. What can be overridden is only ever an
 * opinion about a mistake that exists: its type, its explanation, and whether it counts.
 */
export function StepMistakes({ exercise, onChange }: StepMistakesProps) {
  const t = useTranslations('Authoring');
  const totals = coverage(exercise);
  /** `passage` is one text by definition; extra items stay stored and are reported in step 1. */
  const shown = exercise.mode === 'passage' ? exercise.items.slice(0, 1) : exercise.items;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const pendingFocus = useRef<string | null>(null);
  const fields = useRef(new Map<string, HTMLTextAreaElement | null>());

  /**
   * Focus follows the edit: into the item just added, and onto the card that took the
   * place of a deleted one. It waits for the list to re-render, which is why it is a ref
   * and not state — where the focus goes is not something to render.
   */
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    fields.current.get(id)?.focus();
  }, [exercise.items]);

  function toggleExpanded(itemId: string) {
    const next = new Set(expanded);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setExpanded(next);
  }

  function handleAdd() {
    const item = emptyItem();
    pendingFocus.current = item.id;
    onChange(addItem(exercise, item));
  }

  function handleRemove(index: number) {
    const item = shown[index]!;
    const next = shown[index + 1] ?? shown[index - 1];
    if (next !== undefined) pendingFocus.current = next.id;
    onChange(removeItem(exercise, item.id));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">
          {exercise.mode === 'passage'
            ? t('errorCorrection.step2.titlePassage')
            : t('errorCorrection.step2.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('errorCorrection.step2.lede')}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={totals.errors} label={t('errorCorrection.step2.statErrors')} />
        <Stat
          value={totals.items}
          label={
            exercise.mode === 'passage'
              ? t('errorCorrection.step2.statTexts')
              : t('errorCorrection.step2.statSentences')
          }
        />
        <Stat value={totals.explained} label={t('errorCorrection.step2.statExplained')} />
        <Stat value={totals.multiVariant} label={t('errorCorrection.step2.statMultiVariant')} />
      </dl>

      {totals.errors > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {SPAN_TYPES.filter((type) => (totals.byType[type] ?? 0) > 0).map((type) => (
            <li
              key={type}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-[var(--ssz-text-secondary)]"
            >
              {t(`errorCorrection.spanType.${type}` as 'errorCorrection.spanType.form')} ·{' '}
              {totals.byType[type]}
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-col gap-3">
        {shown.map((item, index) => (
          <li key={item.id}>
            <ItemCard
              exercise={exercise}
              item={item}
              index={index}
              expanded={expanded.has(item.id)}
              registerField={(element) => fields.current.set(item.id, element)}
              onChange={onChange}
              onToggleExpanded={() => toggleExpanded(item.id)}
              onRemove={() => handleRemove(index)}
            />
          </li>
        ))}
      </ul>

      {exercise.mode === 'sentences' && (
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={handleAdd}>
            <Plus className="size-4" aria-hidden />
            {t('errorCorrection.step2.addSentence')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('errorCorrection.step2.itemCount', { count: totals.items })}
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-[var(--ssz-bg-subtle)] px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

interface ItemCardProps {
  exercise: ErrorCorrection;
  item: Item;
  index: number;
  expanded: boolean;
  registerField: (element: HTMLTextAreaElement | null) => void;
  onChange: (next: ErrorCorrection) => void;
  onToggleExpanded: () => void;
  onRemove: () => void;
}

/**
 * One item: the sentence with the mistake, the answer key, and what falls out of them.
 *
 * The two fields sit side by side and are coloured against each other, because the pair
 * is the unit of authoring here — a faulty sentence with no key is not half an exercise,
 * it is nothing at all, and the card says so rather than waiting for the gate.
 */
function ItemCard({
  exercise,
  item,
  index,
  expanded,
  registerField,
  onChange,
  onToggleExpanded,
  onRemove,
}: ItemCardProps) {
  const t = useTranslations('Authoring');
  const derived = spans(item, exercise.check);
  const hard = derived.filter((span) => !span.soft);
  const written = item.wrong.trim() !== '';
  const missingRef = written && item.ref.trim() === '';
  const identical = hasRef(item) && derived.length === 0;
  const allSoft = hasRef(item) && derived.length > 0 && hard.length === 0;
  const rows = exercise.mode === 'passage' ? 5 : 2;

  /**
   * The alternatives field, as it is being typed. The document keeps parsed lines, so a
   * newline the author has just pressed would disappear from under the cursor if the
   * field rendered straight from it.
   */
  const [altsText, setAltsText] = useState(() => item.alts.join('\n'));

  const label =
    exercise.mode === 'passage'
      ? t('errorCorrection.step2.textLabel')
      : t('errorCorrection.step2.sentenceLabel', { index: index + 1 });

  return (
    <div
      className={`rounded-lg border bg-surface ${
        missingRef || identical || allSoft ? 'border-error' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-[var(--ssz-bg-subtle)] text-xs font-semibold">
          {index + 1}
        </span>
        {hard.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('errorCorrection.step2.errorsHere', { count: hard.length })}
          </span>
        )}
        {(missingRef || identical || allSoft) && (
          <span className="flex items-center gap-1 text-xs text-error">
            <AlertTriangle className="size-3.5" aria-hidden />
            {missingRef
              ? t('errorCorrection.step2.badgeNoRef')
              : identical
                ? t('errorCorrection.step2.badgeIdentical')
                : t('errorCorrection.step2.badgeAllSoft')}
          </span>
        )}
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('errorCorrection.step2.duplicate')}
          onClick={() => onChange(duplicateItem(exercise, item.id))}
        >
          <Copy className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('errorCorrection.step2.remove')}
          onClick={onRemove}
        >
          <Trash2 className="size-4 text-error" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-label={t('errorCorrection.step2.more')}
          onClick={onToggleExpanded}
        >
          {expanded ? (
            <ChevronUp className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor={`ec-wrong-${item.id}`}>
              {t('errorCorrection.step2.wrongLabel', { label })}
            </label>
            <Textarea
              id={`ec-wrong-${item.id}`}
              ref={registerField}
              rows={rows}
              value={item.wrong}
              placeholder="I går jeg gikk på kino."
              style={{ fontFamily: READING }}
              className="border-error/60 focus-visible:border-error"
              onChange={(event) =>
                onChange(setItem(exercise, item.id, { wrong: event.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" htmlFor={`ec-ref-${item.id}`}>
              {t('errorCorrection.step2.refLabel')}
            </label>
            <Textarea
              id={`ec-ref-${item.id}`}
              rows={rows}
              value={item.ref}
              hasError={missingRef}
              aria-invalid={missingRef}
              placeholder="I går gikk jeg på kino."
              style={{ fontFamily: READING }}
              className={
                missingRef ? undefined : 'border-success-500/60 focus-visible:border-success-500'
              }
              onChange={(event) =>
                onChange(setItem(exercise, item.id, { ref: event.target.value }))
              }
            />
            {missingRef && (
              <p className="text-xs text-error">{t('errorCorrection.step2.refRequired')}</p>
            )}
          </div>
        </div>

        {derived.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-xs font-medium">
              <Target className="size-3.5" aria-hidden />
              {t('errorCorrection.step2.foundLabel')}
            </p>
            <ul className="flex flex-col gap-2">
              {derived.map((span) => (
                <li key={span.key}>
                  <SpanRow exercise={exercise} item={item} span={span} onChange={onChange} />
                </li>
              ))}
            </ul>
          </div>
        ) : identical ? (
          <p className="flex items-center gap-2 rounded-md border border-warning-300 bg-warning-50 px-3 py-2 text-sm text-warning-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {t('errorCorrection.step2.identical')}
          </p>
        ) : null}

        {expanded && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" htmlFor={`ec-alts-${item.id}`}>
                {t('errorCorrection.step2.altsLabel')}
              </label>
              <Textarea
                id={`ec-alts-${item.id}`}
                rows={2}
                value={altsText}
                style={{ fontFamily: READING }}
                onChange={(event) => {
                  setAltsText(event.target.value);
                  onChange(setItem(exercise, item.id, { alts: parseAlts(event.target.value) }));
                }}
              />
              <p className="text-xs text-muted-foreground">{t('errorCorrection.step2.altsHelp')}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" htmlFor={`ec-hint-${item.id}`}>
                {t('errorCorrection.step2.hintLabel')}
              </label>
              <Input
                id={`ec-hint-${item.id}`}
                value={item.hint ?? ''}
                placeholder={t('errorCorrection.step2.hintPlaceholder')}
                onChange={(event) =>
                  onChange(setItem(exercise, item.id, { hint: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">{t('errorCorrection.step2.hintHelp')}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" htmlFor={`ec-teacher-${item.id}`}>
                {t('errorCorrection.step2.teacherNoteLabel')}
              </label>
              <Input
                id={`ec-teacher-${item.id}`}
                value={item.teacherNote ?? ''}
                placeholder={t('errorCorrection.step2.teacherNotePlaceholder')}
                onChange={(event) =>
                  onChange(setItem(exercise, item.id, { teacherNote: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('errorCorrection.step2.teacherNoteHelp')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SpanRowProps {
  exercise: ErrorCorrection;
  item: Item;
  span: Span;
  onChange: (next: ErrorCorrection) => void;
}

/**
 * One derived mistake: what it replaces, what kind it is, and why it is wrong.
 *
 * “Accept both” is the escape hatch for the case the alignment gets right and the author
 * did not mean: a difference that is a legitimate variation rather than an error. It sets
 * `soft`, and a soft span is counted nowhere the student can see — which is why the row
 * loses its number when it is set.
 */
function SpanRow({ exercise, item, span, onChange }: SpanRowProps) {
  const t = useTranslations('Authoring');

  return (
    <div
      className={`flex flex-col gap-2 rounded-md border px-3 py-2 ${
        span.soft ? 'border-dashed border-border opacity-70' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {span.soft ? '–' : span.index + 1}
        </span>
        <span className="text-sm" style={{ fontFamily: READING }}>
          {span.wrong === '' ? (
            <em className="text-muted-foreground">{t('errorCorrection.step2.nothingThere')}</em>
          ) : (
            <b>{span.wrong}</b>
          )}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-sm" style={{ fontFamily: READING }}>
          {span.fix === '' ? (
            <em className="text-muted-foreground">{t('errorCorrection.step2.struckOut')}</em>
          ) : (
            <em>{span.fix}</em>
          )}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={span.soft}
          title={t('errorCorrection.step2.acceptBothHelp')}
          onClick={() =>
            onChange(setSpanOverride(exercise, item.id, span.key, { soft: !span.soft }))
          }
        >
          {span.soft
            ? t('errorCorrection.step2.acceptBothOn')
            : t('errorCorrection.step2.acceptBoth')}
        </Button>
      </div>

      <div
        role="radiogroup"
        aria-label={t('errorCorrection.step2.typeLabel')}
        className="flex flex-wrap gap-1"
      >
        {SPAN_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={span.type === type}
            title={t(`errorCorrection.spanTypeHelp.${type}` as 'errorCorrection.spanTypeHelp.form')}
            onClick={() => onChange(setSpanOverride(exercise, item.id, span.key, { type }))}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              span.type === type
                ? 'border-primary bg-primary-50 text-primary'
                : 'border-border text-[var(--ssz-text-secondary)] hover:bg-[var(--ssz-bg-subtle)]'
            }`}
          >
            {t(`errorCorrection.spanType.${type}` as 'errorCorrection.spanType.form')}
          </button>
        ))}
      </div>

      <Input
        value={span.note}
        aria-label={t('errorCorrection.step2.spanNoteLabel', {
          wrong: span.wrong === '' ? t('errorCorrection.step2.nothingThere') : span.wrong,
        })}
        placeholder={t('errorCorrection.step2.spanNotePlaceholder')}
        onChange={(event) =>
          onChange(setSpanOverride(exercise, item.id, span.key, { note: event.target.value }))
        }
      />
    </div>
  );
}
