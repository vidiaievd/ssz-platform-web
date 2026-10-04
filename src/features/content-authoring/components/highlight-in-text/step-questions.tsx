'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  AlignLeft,
  ArrowLeft,
  Eraser,
  Highlighter,
  List,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { MarkableText, type MarkCell } from '@/features/student/exercises/runner/markable-text';
import {
  canAddQuestion,
  canPutBack,
  density,
  HT_DENSITY_HIGH,
  HT_MAX_Q,
  issues,
  markedWords,
  overlaps,
  spanOrdinals,
  spanRuns,
  tokenize,
  type HighlightInTextContent,
  type Question,
  type Unit,
} from '@/lib/shared-kernel/highlight-in-text';

import {
  addQuestion,
  clearMarks,
  dropOrphan,
  putBack,
  removeQuestion,
  removeSpan,
  resizeMark,
  setQuestion,
  setSpanWhy,
  toggleMark,
} from './edits';
import { Bar, Callout, Card, EmptyState, Field, StepHead } from './parts';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;
const MONO = { fontFamily: 'var(--ssz-font-mono)' } as const;

export interface StepQuestionsProps<T extends HighlightInTextContent> {
  exercise: T;
  onChange: (next: T) => void;
  /** «Back to the text» from the empty state. */
  onGoStep: (step: 1 | 2 | 3 | 4) => void;
}

/**
 * Step 2: the questions and the marks that answer them (plan 67 §7.4, BEHAVIOR §3).
 *
 * Up to four questions over one passage, one tab each. The canvas is the same `MarkableText`
 * the student marks in, live: a click marks a word or removes the mark it is in, a drag in a
 * phrase question lays one mark over the run and replaces whatever it crosses, and a
 * `word` question keeps only the drag's origin (AC-M3) — all of it the kernel's
 * `toggleMark`. The key list under it is the same marks in text order, each with its
 * one-line reason; hovering a row outlines its mark in the canvas and the other way round
 * (AC-A7).
 *
 * Orphans — marks a text edit left without their words — sit pinned on top until each is put
 * back or dropped (AC-R3, R4); while one is there the exercise cannot be assigned.
 */
export function StepQuestions<T extends HighlightInTextContent>({
  exercise,
  onChange,
  onGoStep,
}: StepQuestionsProps<T>) {
  const t = useTranslations('Authoring.highlightInText.step2');

  const [selected, setSelected] = useState<string | null>(exercise.questions[0]?.id ?? null);
  const [hot, setHot] = useState<string | null>(null);

  const tokens = useMemo(() => tokenize(exercise.text), [exercise.text]);
  const found = issues(exercise);
  const q: Question | undefined =
    exercise.questions.find((x) => x.id === selected) ?? exercise.questions[0];

  const runs = useMemo(() => (q === undefined ? [] : spanRuns(tokens, q)), [tokens, q]);
  const ordinals = useMemo(
    () => (q === undefined ? new Map<string, number>() : spanOrdinals(q)),
    [q],
  );
  const cellAt = useMemo(() => {
    const map = new Map<number, MarkCell>();
    for (const r of runs) for (let i = r.t0; i <= r.t1; i++) map.set(i, { m: 'key', k: r.span.id });
    return map;
  }, [runs]);

  if (exercise.text.trim() === '') {
    return (
      <div className="flex flex-col gap-5">
        <StepHead eyebrow={t('eyebrow')} title={t('title')} />
        <EmptyState
          icon={AlignLeft}
          title={t('noText.title')}
          body={t('noText.body')}
          action={
            <Button type="button" onClick={() => onGoStep(1)}>
              <ArrowLeft className="size-4" aria-hidden />
              {t('noText.back')}
            </Button>
          }
        />
      </div>
    );
  }

  const incomplete = (x: Question) =>
    found.some(
      (i) =>
        'questionId' in i &&
        i.questionId === x.id &&
        (i.code === 'HT_QUESTION_NO_PROMPT' || i.code === 'HT_QUESTION_NO_SPANS'),
    );
  const mismatch =
    q !== undefined && found.some((i) => i.code === 'HT_UNIT_MISMATCH' && i.questionId === q.id);

  const add = () => {
    const next = addQuestion(exercise);
    onChange(next.ex);
    if (next.added !== null) setSelected(next.added);
  };

  const remove = (id: string) => {
    const rest = exercise.questions.filter((x) => x.id !== id);
    onChange(removeQuestion(exercise, id));
    if (q?.id === id) setSelected(rest[0]?.id ?? null);
  };

  const mark = (origin: number, end: number) => {
    if (q === undefined) return;
    const edit = toggleMark(exercise, q.id, origin, end);
    onChange(edit.ex);
    setHot(edit.added);
  };

  const extend = (i: number, delta: 1 | -1) => {
    if (q === undefined) return;
    const run = runs.find((r) => r.t0 <= i && i <= r.t1);
    if (run !== undefined) onChange(resizeMark(exercise, q.id, run.span.id, delta));
  };

  const promptOf = (x: Question, index: number) =>
    x.prompt.trim() || t('untitledQuestion', { index: index + 1 });
  const tabId = (id: string) => `ht-qtab-${id}`;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede', { max: HT_MAX_Q })} />

      {exercise.orphans.length > 0 && (
        <section
          aria-labelledby="ht-orphans-title"
          className="rounded-(--ssz-radius-md) border border-(--ssz-color-warning-300) bg-(--ssz-color-warning-50)"
        >
          <h3
            id="ht-orphans-title"
            className="m-0 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-(--ssz-color-warning-700)"
          >
            <AlertTriangle size={15} aria-hidden="true" />
            {t('orphans.title', { count: exercise.orphans.length })}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-[7px] px-3 pb-3">
            {exercise.orphans.map((o) => {
              const owner = exercise.questions.find((x) => x.id === o.qid);
              const ownerIndex = exercise.questions.findIndex((x) => x.id === o.qid);
              return (
                <li
                  key={o.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-(--ssz-radius-sm) bg-(--ssz-bg-surface) px-2.5 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <b className="font-semibold" style={READING}>
                      {o.surface}
                    </b>
                    {owner !== undefined && (
                      <span className="text-xs text-(--ssz-text-muted)">
                        {' · '}
                        {promptOf(owner, ownerIndex)}
                      </span>
                    )}
                  </span>
                  {canPutBack(exercise, o) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onChange(putBack(exercise, o.id))}
                    >
                      <Highlighter className="size-3.5" aria-hidden />
                      {t('orphans.putBack')}
                    </Button>
                  ) : (
                    <span className="text-xs text-(--ssz-text-muted)">{t('orphans.gone')}</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('orphans.drop', { surface: o.surface })}
                    className="hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700)"
                    onClick={() => onChange(dropOrphan(exercise, o.id))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <div
          role="tablist"
          aria-label={t('tabsLabel')}
          className="flex flex-wrap items-center gap-1.5"
        >
          {exercise.questions.map((x, i) => {
            const active = x.id === q?.id;
            const bad = incomplete(x);
            return (
              <button
                key={x.id}
                id={tabId(x.id)}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="ht-question-panel"
                data-bad={bad ? '' : undefined}
                onClick={() => setSelected(x.id)}
                className="inline-flex max-w-[26ch] min-h-[34px] items-center gap-[7px] overflow-hidden rounded-full border px-3 py-1.5 text-xs font-medium text-ellipsis whitespace-nowrap focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none"
                style={
                  active
                    ? {
                        background: bad
                          ? 'var(--ssz-color-error-500)'
                          : 'var(--ssz-interactive-primary)',
                        borderColor: bad
                          ? 'var(--ssz-color-error-500)'
                          : 'var(--ssz-interactive-primary)',
                        color: 'var(--ssz-text-inverse)',
                      }
                    : {
                        background: 'var(--ssz-bg-surface)',
                        borderColor: bad
                          ? 'var(--ssz-color-error-300)'
                          : 'var(--ssz-border-default)',
                        color: 'var(--ssz-text-secondary)',
                      }
                }
              >
                <i className="text-[10px] not-italic opacity-75" style={MONO}>
                  {i + 1}
                </i>
                <span className="truncate">{x.prompt.trim() || t('newQuestion')}</span>
                <i className="text-[10px] not-italic opacity-75" style={MONO}>
                  {x.spans.length}
                </i>
              </button>
            );
          })}
        </div>
        {canAddQuestion(exercise) ? (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="size-3.5" aria-hidden />
            {t('addQuestion')}
          </Button>
        ) : (
          <span role="note" className="text-xs text-(--ssz-text-muted)">
            {t('ceiling', { max: HT_MAX_Q })}
          </span>
        )}
      </div>

      {q !== undefined && (
        <div
          id="ht-question-panel"
          role="tabpanel"
          aria-labelledby={tabId(q.id)}
          className="flex flex-col gap-5"
        >
          <Card>
            <Field label={t('promptLabel')} htmlFor="ht-prompt" required>
              <Input
                id="ht-prompt"
                aria-required
                className="text-base"
                style={READING}
                value={q.prompt}
                placeholder={t('promptPlaceholder')}
                onChange={(event) =>
                  onChange(setQuestion(exercise, q.id, { prompt: event.target.value }))
                }
              />
            </Field>
            <Field
              label={t('unitLabel')}
              message={{
                tone: 'hint',
                text: q.unit === 'word' ? t('unitHelp.word') : t('unitHelp.phrase'),
                id: 'ht-unit-help',
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Segmented<Unit>
                  aria-label={t('unitLabel')}
                  size="sm"
                  value={q.unit}
                  onValueChange={(unit) => onChange(setQuestion(exercise, q.id, { unit }))}
                  options={[
                    { value: 'word', label: t('unit.word') },
                    { value: 'phrase', label: t('unit.phrase') },
                  ]}
                />
                {mismatch && (
                  <span className="text-xs text-(--ssz-color-warning-700)">
                    {t('unitMismatch')}
                  </span>
                )}
              </div>
            </Field>
          </Card>

          <Card
            icon={Highlighter}
            title={t('canvas.title')}
            labelledBy="ht-canvas-title"
            note={q.unit === 'word' ? t('canvas.noteWord') : t('canvas.notePhrase')}
            flush
            foot={
              <div className="flex flex-wrap items-center gap-3 rounded-b-(--ssz-radius-md) border-t border-(--ssz-border-default) bg-(--ssz-bg-subtle) px-4 py-[9px] text-xs text-(--ssz-text-muted)">
                <span>
                  {t.rich('canvas.count', {
                    count: q.spans.length,
                    marked: markedWords(tokens, q),
                    words: tokens.length,
                    b: (chunks) => <b className="text-(--ssz-text-secondary)">{chunks}</b>,
                  })}
                </span>
                <span className="flex-1" />
                {overlaps(q) && (
                  <span className="text-(--ssz-color-error-600)">{t('canvas.overlap')}</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={q.spans.length === 0}
                  onClick={() => onChange(clearMarks(exercise, q.id))}
                >
                  <Eraser className="size-3.5" aria-hidden />
                  {t('canvas.clear')}
                </Button>
              </div>
            }
          >
            <div className="px-5 pt-5 pb-4">
              <MarkableText
                text={exercise.text}
                live
                unit={q.unit}
                cellOf={(i) => cellAt.get(i) ?? null}
                numbers={(i) => {
                  const cell = cellAt.get(i);
                  return cell === undefined ? null : (ordinals.get(cell.k) ?? null);
                }}
                onRange={mark}
                onExtend={extend}
                hot={hot}
                onHover={setHot}
                labelledBy="ht-canvas-title"
              />
            </div>
          </Card>

          <Card icon={List} title={t('key.title')} note={t('key.note')}>
            {runs.length === 0 ? (
              <EmptyState
                icon={Highlighter}
                title={t('key.emptyTitle')}
                body={t('key.emptyBody')}
              />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {runs.map((r) => {
                  const n = ordinals.get(r.span.id) ?? 0;
                  const surface = exercise.text.slice(r.span.start, r.span.end);
                  return (
                    <li
                      key={r.span.id}
                      data-hot={hot === r.span.id ? '' : undefined}
                      onPointerEnter={() => setHot(r.span.id)}
                      onPointerLeave={() => setHot(null)}
                      className="grid grid-cols-[22px_minmax(120px,1.1fr)_minmax(0,2fr)_30px] items-center gap-[9px] rounded-(--ssz-radius-md) border px-2.5 py-[7px] max-[820px]:grid-cols-[22px_minmax(0,1fr)_30px]"
                      style={{
                        background: 'var(--ssz-bg-surface)',
                        borderColor:
                          hot === r.span.id
                            ? 'var(--ssz-color-primary-300)'
                            : 'var(--ssz-border-default)',
                        boxShadow: hot === r.span.id ? 'var(--ssz-shadow-xs)' : undefined,
                      }}
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
                        className="border-transparent bg-transparent px-2 py-1.5 text-sm focus:bg-(--ssz-bg-surface) max-[820px]:order-last max-[820px]:col-span-full"
                        aria-label={t('key.whyLabel', { n, surface })}
                        placeholder={t('key.whyPlaceholder')}
                        value={r.span.why}
                        onFocus={() => setHot(r.span.id)}
                        onChange={(event) =>
                          onChange(setSpanWhy(exercise, q.id, r.span.id, event.target.value))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('key.remove', { n, surface })}
                        className="hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700)"
                        onClick={() => onChange(removeSpan(exercise, q.id, r.span.id))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card icon={Target} title={t('density.title')} note={t('density.note')}>
            {exercise.questions.map((x, i) => {
              const share = density(exercise, x);
              const label = promptOf(x, i);
              return (
                <div
                  key={x.id}
                  className="grid grid-cols-[130px_minmax(0,1fr)_54px] items-center gap-2.5 text-xs"
                >
                  <b className="truncate font-semibold">{label}</b>
                  <Bar
                    value={share * 200}
                    skew={share > HT_DENSITY_HIGH}
                    label={t('density.bar', { label })}
                  />
                  <span
                    className="text-right text-(--ssz-text-muted)"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {Math.round(share * 100)}%
                  </span>
                </div>
              );
            })}
          </Card>

          {exercise.questions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hover:bg-(--ssz-color-error-50) hover:text-(--ssz-color-error-700)"
                onClick={() => remove(q.id)}
              >
                <Trash2 className="size-4" aria-hidden />
                {t('remove', {
                  prompt: q.prompt.trim() || t('newQuestion'),
                  count: q.spans.length,
                })}
              </Button>
            </div>
          )}
        </div>
      )}

      <Callout tone="tip">{t('tip')}</Callout>
    </div>
  );
}
