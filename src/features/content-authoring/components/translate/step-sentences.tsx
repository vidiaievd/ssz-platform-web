'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Repeat,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import {
  coverage,
  expandRef,
  hasAlts,
  itemDirection,
  refs as refsOf,
  variants,
  type Item,
  type Translate,
} from '@/lib/shared-kernel/translate';

import { TrTester } from './tr-tester';
import {
  addGloss,
  addItem,
  addRef,
  duplicateItem,
  emptyItem,
  removeGloss,
  removeItem,
  removeRef,
  setGloss,
  setItem,
  setRef,
} from './edits';

const READING = 'var(--ssz-font-reading)';

/** Enough expanded variants to see what a line does; past this the chips are a wall. */
const SHOWN_VARIANTS = 6;

export interface StepSentencesProps {
  exercise: Translate;
  onChange: (next: Translate) => void;
}

/**
 * Step 2 of the translate builder: the sentences, and the translations that count as right.
 *
 * The counter at the top is the quality metric of this template, not decoration. The
 * auto-check may only approve an answer that hits the key, so every correct translation
 * the author did not write down becomes a submission a teacher has to read by hand — the
 * number of accepted variants is a direct prediction of how much marking this exercise
 * generates. `explained` sits beside it as the other half of the same idea: when the
 * machine cannot say why an answer is wrong, only the author's own explanation can.
 * Neither number gates anything (plan 42, "Разбор ошибки"); both are visible.
 */
export function StepSentences({ exercise, onChange }: StepSentencesProps) {
  const t = useTranslations('Authoring');
  const totals = coverage(exercise);
  /** `single` is one sentence by definition; extra ones stay stored and are warned about. */
  const shown = exercise.format === 'single' ? exercise.items.slice(0, 1) : exercise.items;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const pendingFocus = useRef<string | null>(null);
  const fields = useRef(new Map<string, HTMLTextAreaElement | null>());

  /**
   * Focus follows the edit: into the sentence just added, and onto the card that took the
   * place of a deleted one. Where the focus goes is not something to render, so it is a
   * ref rather than state.
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
    // A new sentence inherits the set's direction; under `both` it starts the way the
    // previous one reads, which is nearly always the way the author is still typing.
    const last = exercise.items[exercise.items.length - 1];
    const item = emptyItem(
      exercise.dir === 'both' ? (last?.dir ?? 'to_target') : (exercise.dir as Item['dir']),
    );
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
        <h2 className="text-base font-semibold">{t('translate.step2.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('translate.step2.lede')}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={totals.items} label={t('translate.step2.statSentences')} />
        <Stat value={totals.variants} label={t('translate.step2.statVariants')} />
        <Stat value={totals.multiVariant} label={t('translate.step2.statMultiVariant')} />
        <Stat value={totals.explained} label={t('translate.step2.statExplained')} />
      </dl>

      {/* How much of the set has more than one accepted wording — the share that will not
          send an honest second translation to the queue. */}
      {totals.withRef > 0 && (
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ssz-border-default)]"
          >
            <i
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(totals.multiVariant / totals.withRef) * 100}%` }}
            />
          </span>
          <span className="text-xs text-muted-foreground">
            {t('translate.step2.coverage', {
              multi: totals.multiVariant,
              total: totals.withRef,
            })}
          </span>
        </div>
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

      {exercise.format === 'set' && (
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={handleAdd}>
            <Plus className="size-4" aria-hidden />
            {t('translate.step2.addSentence')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('translate.step2.itemCount', { count: totals.items })}
          </span>
        </div>
      )}

      <TrTester exercise={exercise} />
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
  exercise: Translate;
  item: Item;
  index: number;
  expanded: boolean;
  registerField: (element: HTMLTextAreaElement | null) => void;
  onChange: (next: Translate) => void;
  onToggleExpanded: () => void;
  onRemove: () => void;
}

/**
 * One sentence: what the student reads, and every translation that counts as right.
 *
 * A sentence with no accepted translation is called out on the card rather than left to
 * the finish gate — it is the one state where the exercise is not merely unpolished but
 * unplayable, since the check has nothing to measure against.
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
  const keys = refsOf(item);
  const missingRef = item.source.trim() !== '' && keys.length === 0;
  const dir = itemDirection(exercise, item);

  return (
    <div
      className={`rounded-lg border p-3 ${
        missingRef ? 'border-error/60 bg-error/5' : 'border-border bg-surface'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('translate.step2.sentenceLabel', { index: index + 1 })}
        </span>

        {/* Under `both`, which way this one sentence goes is a property of the sentence,
            so it is edited on the sentence. */}
        {exercise.dir === 'both' && (
          <button
            type="button"
            onClick={() =>
              onChange(
                setItem(exercise, item.id, {
                  dir: dir === 'to_target' ? 'from_target' : 'to_target',
                }),
              )
            }
            className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-[var(--ssz-bg-subtle)]"
          >
            <Repeat className="size-3" aria-hidden />
            {dir === 'to_target'
              ? t('translate.step2.dirPill', {
                  from: exercise.langs.explain,
                  to: exercise.langs.target,
                })
              : t('translate.step2.dirPill', {
                  from: exercise.langs.target,
                  to: exercise.langs.explain,
                })}
          </button>
        )}

        {missingRef && (
          <span className="flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-[11px] font-semibold text-error">
            <TriangleAlert className="size-3" aria-hidden />
            {t('translate.step2.missingRef')}
          </span>
        )}

        <span className="flex-1" />

        <button
          type="button"
          aria-label={t('translate.step2.duplicate')}
          title={t('translate.step2.duplicate')}
          onClick={() => onChange(duplicateItem(exercise, item.id))}
          className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-[var(--ssz-bg-subtle)]"
        >
          <Copy className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t('translate.step2.remove')}
          title={t('translate.step2.remove')}
          onClick={onRemove}
          className="flex size-8 items-center justify-center rounded-md border border-border text-error hover:bg-error/10"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`tr-source-${item.id}`}>
          {t('translate.step2.sourceLabel', {
            lang: dir === 'from_target' ? exercise.langs.target : exercise.langs.explain,
          })}
        </label>
        <Textarea
          id={`tr-source-${item.id}`}
          ref={registerField}
          rows={2}
          value={item.source}
          style={{ fontFamily: READING }}
          placeholder={t('translate.step2.sourcePlaceholder')}
          onChange={(event) => onChange(setItem(exercise, item.id, { source: event.target.value }))}
        />
      </div>

      <p className="mt-3 flex items-center gap-1 text-xs font-medium">
        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
        {t('translate.step2.refsLabel', {
          lang: dir === 'from_target' ? exercise.langs.explain : exercise.langs.target,
        })}
      </p>

      <ul className="mt-1 flex flex-col gap-2">
        {item.refs.map((ref, at) => (
          <li key={at}>
            <RefRow
              exercise={exercise}
              item={item}
              ref_={ref}
              at={at}
              onChange={onChange}
              canRemove={item.refs.length > 1}
            />
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(addRef(exercise, item.id))}
        >
          <Plus className="size-3.5" aria-hidden />
          {t('translate.step2.addRef')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('translate.step2.variantCount', { count: variants(item).length })}
        </span>
        <span className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpanded}>
          {expanded ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )}
          {expanded ? t('translate.step2.less') : t('translate.step2.more')}
        </Button>
      </div>

      {expanded && <ItemExtras exercise={exercise} item={item} onChange={onChange} />}
    </div>
  );
}

interface RefRowProps {
  exercise: Translate;
  item: Item;
  ref_: string;
  at: number;
  canRemove: boolean;
  onChange: (next: Translate) => void;
}

/**
 * One accepted translation. The first is the primary one — shown to the student when the
 * key is revealed — and the rest score exactly the same.
 *
 * A line with inline alternatives shows what it expands into. Authors write
 * `Jeg (liker|elsker) katter` and cannot count what they have made; the chips are the
 * answer, and they are also where a broken bracket becomes visible before the gate says so.
 */
function RefRow({ exercise, item, ref_, at, canRemove, onChange }: RefRowProps) {
  const t = useTranslations('Authoring');
  const expanded = hasAlts(ref_) ? expandRef(ref_) : [];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[11px] font-semibold text-muted-foreground uppercase">
          {at === 0 ? t('translate.step2.refPrimary') : t('translate.step2.refAlt', { at })}
        </span>
        <Input
          value={ref_}
          style={{ fontFamily: READING }}
          hasError={at === 0 && ref_.trim() === ''}
          aria-invalid={at === 0 && ref_.trim() === ''}
          aria-label={
            at === 0
              ? t('translate.step2.refPrimary')
              : t('translate.step2.refAlt', { at })
          }
          placeholder={t('translate.step2.refPlaceholder')}
          onChange={(event) => onChange(setRef(exercise, item.id, at, event.target.value))}
        />
        {canRemove && (
          <button
            type="button"
            aria-label={t('translate.step2.removeRef')}
            title={t('translate.step2.removeRef')}
            onClick={() => onChange(removeRef(exercise, item.id, at))}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-[var(--ssz-bg-subtle)]"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      {expanded.length > 1 ? (
        <div className="ml-16 flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-muted-foreground">
            {t('translate.step2.expandsTo', { count: expanded.length })}
          </span>
          {expanded.slice(0, SHOWN_VARIANTS).map((variant, index) => (
            <span
              key={index}
              className="rounded-full border border-border px-2 py-0.5 text-[11px]"
              style={{ fontFamily: READING }}
            >
              {variant}
            </span>
          ))}
          {expanded.length > SHOWN_VARIANTS && (
            <span className="text-[11px] text-muted-foreground">
              {t('translate.step2.andMore', { count: expanded.length - SHOWN_VARIANTS })}
            </span>
          )}
        </div>
      ) : (
        at === 0 && (
          <p className="ml-16 text-[11px] text-muted-foreground">
            {t('translate.step2.altsSyntax')}
          </p>
        )
      )}
    </div>
  );
}

interface ItemExtrasProps {
  exercise: Translate;
  item: Item;
  onChange: (next: Translate) => void;
}

/** Everything that helps the student or the teacher, but is not the key itself. */
function ItemExtras({ exercise, item, onChange }: ItemExtrasProps) {
  const t = useTranslations('Authoring');
  const [word, setWord] = useState('');
  const [gloss, setGlossText] = useState('');

  function commitGloss() {
    if (word.trim() === '' && gloss.trim() === '') return;
    onChange(addGloss(exercise, item.id, { w: word.trim(), t: gloss.trim() }));
    setWord('');
    setGlossText('');
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`tr-hint-${item.id}`}>
          {t('translate.step2.hintLabel')}
        </label>
        <Input
          id={`tr-hint-${item.id}`}
          value={item.hint ?? ''}
          placeholder={t('translate.step2.hintPlaceholder')}
          onChange={(event) => onChange(setItem(exercise, item.id, { hint: event.target.value }))}
        />
        <p className="text-xs text-muted-foreground">{t('translate.step2.hintHelp')}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{t('translate.step2.glossLabel')}</span>
        {item.gloss.length > 0 && (
          <ul className="flex flex-col gap-1">
            {item.gloss.map((entry, at) => (
              <li key={at} className="flex items-center gap-2">
                <Input
                  value={entry.w}
                  aria-label={t('translate.step2.glossWord')}
                  onChange={(event) =>
                    onChange(setGloss(exercise, item.id, at, { w: event.target.value }))
                  }
                />
                <Input
                  value={entry.t}
                  aria-label={t('translate.step2.glossTranslation')}
                  onChange={(event) =>
                    onChange(setGloss(exercise, item.id, at, { t: event.target.value }))
                  }
                />
                <button
                  type="button"
                  aria-label={t('translate.step2.removeGloss')}
                  onClick={() => onChange(removeGloss(exercise, item.id, at))}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-[var(--ssz-bg-subtle)]"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <Input
            value={word}
            aria-label={t('translate.step2.glossWord')}
            placeholder={t('translate.step2.glossWordPlaceholder')}
            onChange={(event) => setWord(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitGloss();
              }
            }}
          />
          <Input
            value={gloss}
            aria-label={t('translate.step2.glossTranslation')}
            placeholder={t('translate.step2.glossTranslationPlaceholder')}
            onChange={(event) => setGlossText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitGloss();
              }
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={commitGloss}>
            <Plus className="size-3.5" aria-hidden />
            {t('translate.step2.addGloss')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('translate.step2.glossHelp')}</p>
      </div>

      {/*
        Why the key reads the way it does. This is the sentence-level half of the error
        analysis this template rests on: the machine cannot say why a translation is wrong
        without inventing a reason, so anything worth saying, the author says here.
      */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`tr-explanation-${item.id}`}>
          {t('translate.step2.explanationLabel')}
        </label>
        <Textarea
          id={`tr-explanation-${item.id}`}
          rows={2}
          value={item.explanation ?? ''}
          placeholder={t('translate.step2.explanationPlaceholder')}
          onChange={(event) =>
            onChange(setItem(exercise, item.id, { explanation: event.target.value }))
          }
        />
        <p className="text-xs text-muted-foreground">{t('translate.step2.explanationHelp')}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor={`tr-teacher-${item.id}`}>
          {t('translate.step2.teacherNoteLabel')}
        </label>
        <Input
          id={`tr-teacher-${item.id}`}
          value={item.teacherNote ?? ''}
          placeholder={t('translate.step2.teacherNotePlaceholder')}
          onChange={(event) =>
            onChange(setItem(exercise, item.id, { teacherNote: event.target.value }))
          }
        />
        <p className="text-xs text-muted-foreground">{t('translate.step2.teacherNoteHelp')}</p>
      </div>
    </div>
  );
}
