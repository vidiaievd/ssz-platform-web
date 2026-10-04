'use client';

import { useState } from 'react';
import { AlertTriangle, Highlighter, Pencil, Target, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Textarea } from '@/components/ui/textarea';
import { DiffLegend, DiffLine, DiffScore, DiffTally } from '@/features/student/exercises/runner';
import {
  demoAnswer,
  diff,
  focusCoverage,
  issues,
  packOf,
  passes,
  readySegments,
  tokens,
  type DictationContent,
  type Near,
  type Segment,
} from '@/lib/shared-kernel/dictation';

import { Bar, Card, EmptyState, Field, StepHead } from '../highlight-in-text/parts';
import { ToggleRow } from '../toggle-row';
import {
  canPutBack,
  dropOrphan,
  putBack,
  setFocusWhy,
  setMarking,
  setSegmentWhy,
  toggleFocus,
} from './edits';
import { WordPicker } from './word-picker';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

/** How much of the sentence the card head shows before it trims. */
const GLANCE = 54;

export interface StepMarkingProps<T extends DictationContent> {
  exercise: T;
  onChange: (next: T) => void;
  /** «Back to the key» on the empty state. Absent: the button is not drawn. */
  onBackToKey?: () => void;
}

/**
 * Step 3: errors and reasons (plan 68 §7.6).
 *
 * The rules are chosen against a real answer: «Try a student answer» runs the kernel's own
 * `diff` on every change and stores nothing (AC-B8) — the same function the server grades
 * with. A word is marked by clicking it; a mark with no reason is drawn dashed (AC-B6); a
 * mark whose word an edit removed waits in the orphan panel until it is put back or dropped
 * (AC-B7). Every sentence needs one line for «what to say when it comes back wrong» — a
 * dictation that answers only «feil» teaches copying.
 */
export function StepMarking<T extends DictationContent>({
  exercise,
  onChange,
  onBackToKey,
}: StepMarkingProps<T>) {
  const t = useTranslations('Authoring.dictation.step3');

  const ready = readySegments(exercise);
  const first = ready[0];
  const pack = packOf(exercise.language);
  const { marking } = exercise;

  // The author's own text for the panel; `null` keeps the generated one (it follows the key).
  const [typed, setTyped] = useState<string | null>(null);

  if (first === undefined) {
    return (
      <div className="flex flex-col gap-5">
        <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />
        <EmptyState
          icon={Target}
          title={t('empty.title')}
          body={t('empty.body')}
          action={
            onBackToKey === undefined ? undefined : (
              <Button type="button" variant="outline" size="sm" onClick={onBackToKey}>
                {t('empty.back')}
              </Button>
            )
          }
        />
      </div>
    );
  }

  const answer = typed ?? demoAnswer(first.text, pack);
  const result = diff(
    first.text,
    answer,
    marking,
    first.focus.map((f) => f.wordIndex),
    pack,
  );
  const pct = Math.round(result.score * 100);
  const ok = passes(result, exercise.settings.threshold);

  const { total, written } = focusCoverage(exercise);
  const silent = total - written;
  const found = issues(exercise).filter((issue) => issue.step === 3);

  const nearMessage =
    marking.near === 'strict'
      ? t('near.strictHelp')
      : marking.near === 'flag'
        ? t('near.flagHelp')
        : t('near.halfHelp');

  const glance = (seg: Segment) => {
    const text = seg.text.trim();
    return text.length > GLANCE ? `${text.slice(0, GLANCE)}…` : text;
  };
  const numberOf = (id: string) => exercise.segments.findIndex((s) => s.id === id) + 1;

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card icon={Target} title={t('rules.title')} labelledBy="dc-rules-title">
        <ToggleRow
          label={t('rules.caseLabel')}
          help={t('rules.caseHelp')}
          checked={marking.caseSensitive}
          onChange={(caseSensitive) => onChange(setMarking(exercise, { caseSensitive }))}
        />
        <ToggleRow
          label={t('rules.punctuationLabel')}
          help={t('rules.punctuationHelp')}
          checked={marking.punctuation}
          onChange={(punctuation) => onChange(setMarking(exercise, { punctuation }))}
        />
        <Field label={t('near.label')}>
          <Segmented<Near>
            aria-label={t('near.label')}
            value={marking.near}
            onValueChange={(near) => onChange(setMarking(exercise, { near }))}
            options={[
              { value: 'strict', label: t('near.strict') },
              { value: 'flag', label: t('near.flag') },
              { value: 'half', label: t('near.half') },
            ]}
          />
        </Field>
        <p
          data-tone={marking.near === 'half' ? 'warn' : undefined}
          className={`m-0 text-xs ${
            marking.near === 'half' ? 'text-(--ssz-color-warning-700)' : 'text-(--ssz-text-muted)'
          }`}
        >
          {nearMessage}
        </p>
      </Card>

      <Card
        icon={Pencil}
        title={t('try.title')}
        labelledBy="dc-try-title"
        note={t('try.note', { index: numberOf(first.id) })}
      >
        <Textarea
          aria-labelledby="dc-try-title"
          rows={2}
          className="text-base"
          style={{ ...READING, fieldSizing: 'fixed' }}
          value={answer}
          onChange={(event) => setTyped(event.target.value)}
        />
        <div
          data-testid="dc-try-result"
          className="flex flex-col gap-2.5 rounded-(--ssz-radius-sm) border border-(--ssz-border-default) bg-(--ssz-bg-base) p-3"
        >
          <DiffLine ops={result.ops} size="sm" />
          <div className="flex flex-wrap items-center gap-3">
            <DiffTally words={result.words} />
            <span className="flex-1" />
            <DiffScore pct={pct} ok={ok} size="sm" />
          </div>
          <DiffLegend />
        </div>
        <p className="m-0 text-xs text-(--ssz-text-muted)">{t('try.note2')}</p>
      </Card>

      <Card title={t('coverage.title', { written, total })} labelledBy="dc-coverage-title">
        <Bar
          value={total === 0 ? 0 : (written / total) * 100}
          skew={silent > 0}
          label={t('coverage.meter')}
        />
        <p
          className={`m-0 text-xs ${
            silent > 0 ? 'text-(--ssz-color-warning-700)' : 'text-(--ssz-text-muted)'
          }`}
        >
          {total === 0
            ? t('coverage.hint')
            : silent === 0
              ? t('coverage.ok')
              : t('coverage.silent', { count: silent })}
        </p>
      </Card>

      {exercise.orphans.length > 0 && (
        <section
          aria-labelledby="dc-orphans-title"
          className="rounded-(--ssz-radius-md) border border-(--ssz-color-warning-300) bg-(--ssz-color-warning-50)"
        >
          <h3
            id="dc-orphans-title"
            className="m-0 flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-(--ssz-color-warning-700)"
          >
            <AlertTriangle size={15} aria-hidden="true" />
            {t('orphans.title', { count: exercise.orphans.length })}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-[7px] px-3 pb-3">
            {exercise.orphans.map((o) => {
              const index = numberOf(o.segmentId);
              return (
                <li
                  key={o.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-(--ssz-radius-sm) bg-(--ssz-bg-surface) px-2.5 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <b className="font-semibold" style={READING}>
                      {o.surface}
                    </b>
                    {o.why.trim() !== '' && (
                      <span className="text-xs text-(--ssz-text-muted)"> · {o.why}</span>
                    )}
                    {index > 0 && (
                      <span className="text-xs text-(--ssz-text-muted)">
                        {' · '}
                        {t('orphans.segment', { index })}
                      </span>
                    )}
                  </span>
                  {canPutBack(exercise, o.id) ? (
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

      {ready.map((seg) => {
        const num = numberOf(seg.id);
        const needsWhy = found.some(
          (issue) =>
            issue.code === 'DICT_NO_WHY' && 'segmentId' in issue && issue.segmentId === seg.id,
        );
        const whyId = `dc-why-${seg.id}`;
        const sorted = [...seg.focus].sort((a, b) => a.wordIndex - b.wordIndex);
        const words = tokens(seg.text);
        const wordOf = (wordIndex: number) => words[wordIndex]?.w ?? '';
        return (
          <Card
            key={seg.id}
            title={t('seg.title', { index: num })}
            labelledBy={`dc-seg-${seg.id}`}
            note={t('seg.focusCount', { count: seg.focus.length })}
          >
            <p className="m-0 text-sm text-(--ssz-text-secondary)" style={READING}>
              {glance(seg)}
            </p>
            <Field label={t('seg.pick')}>
              <p className="m-0 mb-1 text-xs text-(--ssz-text-muted)">{t('seg.pickHelp')}</p>
              <WordPicker
                segment={seg}
                label={t('seg.pickLabel', { index: num })}
                onToggle={(i) => onChange(toggleFocus(exercise, seg.id, i))}
              />
            </Field>
            {sorted.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {sorted.map((f) => {
                  const word = wordOf(f.wordIndex);
                  return (
                    <li
                      key={f.id}
                      className="grid grid-cols-[minmax(6ch,auto)_minmax(0,1fr)_auto] items-center gap-2 max-[820px]:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <b className="font-semibold" style={READING}>
                        {word}
                      </b>
                      <Input
                        aria-label={t('seg.whyFor', { word })}
                        value={f.why}
                        placeholder={t('seg.whyPlaceholder')}
                        className="max-[820px]:order-3 max-[820px]:col-span-2"
                        onChange={(event) =>
                          onChange(setFocusWhy(exercise, seg.id, f.id, event.target.value))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('seg.unmark', { word })}
                        onClick={() => onChange(toggleFocus(exercise, seg.id, f.wordIndex))}
                      >
                        <Trash2 className="size-3.5 text-(--ssz-color-error-700)" aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Field
              label={t('seg.whyLabel')}
              htmlFor={whyId}
              required
              message={
                needsWhy
                  ? { tone: 'error', text: t('seg.whyRequired'), id: `${whyId}-msg` }
                  : { tone: 'hint', text: t('seg.whyHint'), id: `${whyId}-msg` }
              }
            >
              <Textarea
                id={whyId}
                rows={2}
                aria-invalid={needsWhy || undefined}
                aria-describedby={`${whyId}-msg`}
                value={seg.why}
                placeholder={t('seg.whyPlaceholderSegment')}
                style={{ fieldSizing: 'fixed' }}
                onChange={(event) => onChange(setSegmentWhy(exercise, seg.id, event.target.value))}
              />
            </Field>
          </Card>
        );
      })}
    </div>
  );
}
