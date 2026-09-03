'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  ClipboardPaste,
  Link2,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  completePairs,
  issues,
  type Issue,
  type MatchPairs,
  type Pair,
  type Variant,
} from '@/lib/shared-kernel/match-pairs';

import { withSegment, type AudioDraft, type ItemAudio } from '@/lib/shared-kernel/audio';

import { AudioSegmentField } from '../audio';
import { ReorderWithAnnouncer } from '../lesson-reorder';
import {
  addPair,
  applyPaste,
  emptyPair,
  parsePasteLines,
  removePair,
  reorderPairs,
  setPairHalf,
  setVariant,
  setWhy,
  whyOf,
} from './edits';

/** The reading face the student sees, so the teacher writes in it too. */
const READING = 'var(--ssz-font-reading)';

/** How many parsed rows the paste modal shows before it stops listing them (BEHAVIOR §1.2). */
const PASTE_PREVIEW_ROWS = 6;

export interface StepPairsProps {
  exercise: MatchPairs;
  onChange: (next: MatchPairs) => void;
  /**
   * Whether the stored document actually named its variant, or is merely being read as
   * `pairs` because the field was absent — `hasExplicitVariant` over the raw content.
   * Until the teacher says which kind this is, step 1 holds a blocker: `pairs` carries
   * the weaker publication rule, and nobody should arrive at it by not looking.
   */
  variantChosen: boolean;
  onVariantChosen: (variant: Variant) => void;
  /** The listening layer, held beside the document by the builder (plan 56 phase 6). */
  audio: AudioDraft;
  onAudioChange: (next: AudioDraft) => void;
  disabled?: boolean;
}

/**
 * Step 1 of the match-pairs builder: the pairs themselves, each written whole and cut at
 * the point the student has to think about.
 *
 * Controlled and presentational — document in, document out. The shell (autosave, the
 * step rail, the pre-assign gate, the instruction field) is phase 7 and owns everything
 * else; the derived model and every validation code come from the kernel, so this screen
 * never decides what an answer is or whether the exercise is publishable.
 *
 * `EX_NO_TITLE` is not rendered here, as in the gap-fill builder: the platform has no
 * title on an exercise, and reporting a field that cannot be typed would be a dead end.
 */
export function StepPairs({
  exercise,
  onChange,
  variantChosen,
  onVariantChosen,
  audio,
  onAudioChange,
  disabled = false,
}: StepPairsProps) {
  const t = useTranslations('Authoring');
  const problems = issues(exercise);
  const complete = completePairs(exercise);

  const [pasteText, setPasteText] = useState<string | null>(null);

  const inputs = useRef(new Map<string, HTMLInputElement | null>());
  const addButton = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<string | null>(null);

  /**
   * Focus follows the edit: into the LEFT half of a pair just added (AC-B8), and onto
   * the card that took the place of a deleted one. A ref rather than state, because
   * where the focus goes is not something to render, and it waits for the list to
   * re-render before it can find the field.
   */
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    inputs.current.get(id)?.focus();
  }, [exercise.pairs]);

  function handleAdd() {
    const pair = emptyPair();
    pendingFocus.current = pair.id;
    onChange(addPair(exercise, pair));
  }

  /** After a delete: the card that took its place, else `Add a pair` — never nowhere. */
  function handleDelete(index: number) {
    const pair = exercise.pairs[index];
    if (pair === undefined) return;

    const next = exercise.pairs[index + 1] ?? exercise.pairs[index - 1];
    if (next === undefined) addButton.current?.focus();
    else pendingFocus.current = next.id;

    onChange(removePair(exercise, pair.id));
  }

  function handlePaste() {
    if (pasteText === null) return;
    if (parsePasteLines(pasteText).length > 0) onChange(applyPaste(exercise, pasteText));
    setPasteText(null);
  }

  const parsed = pasteText === null ? [] : parsePasteLines(pasteText);
  const tooFew = problems.find((issue) => issue.code === 'EX_TOO_FEW_PAIRS');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t('matchPairs.step1.title')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t('matchPairs.step1.lede')}
        </p>
      </div>

      <VariantChoice
        variant={variantChosen ? exercise.variant : null}
        disabled={disabled}
        onChoose={(variant) => {
          onVariantChosen(variant);
          onChange(setVariant(exercise, variant));
        }}
      />

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('matchPairs.step1.pairsLabel')}</p>
          <p className="text-xs text-muted-foreground">
            {t('matchPairs.step1.summary', { count: complete.length })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => setPasteText('')}
        >
          <ClipboardPaste className="size-4" aria-hidden />
          {t('matchPairs.step1.pasteList')}
        </Button>
      </div>

      {exercise.pairs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium">{t('matchPairs.step1.emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {t('matchPairs.step1.emptyBody')}
          </p>
          <Button type="button" className="mt-4" disabled={disabled} onClick={handleAdd}>
            <Plus className="size-4" aria-hidden />
            {t('matchPairs.step1.addPair')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{t('matchPairs.step1.reorderHelp')}</p>

          <ReorderWithAnnouncer
            items={exercise.pairs.map((pair) => ({ ...pair, title: pair.left }))}
            onReorder={(reordered) =>
              onChange(
                reorderPairs(
                  exercise,
                  reordered.map(({ title: _title, ...pair }) => pair as Pair),
                ),
              )
            }
          >
            {(pair, position) => (
              <PairCard
                pair={pair}
                index={position - 1}
                why={whyOf(exercise, pair.id)}
                halfEmpty={problems.some(
                  (issue) => issue.code === 'PAIR_HALF_EMPTY' && issue.pairId === pair.id,
                )}
                leftDuplicate={problems.some(
                  (issue) => issue.code === 'PAIR_LEFT_DUPLICATE' && issue.pairId === pair.id,
                )}
                rightLongWords={longRightWords(problems, pair.id)}
                segment={
                  audio.audio.enabled && audio.audio.useSegments
                    ? (audio.segments[pair.id] ?? null)
                    : undefined
                }
                onSegmentChange={(segment) => onAudioChange(withSegment(audio, pair.id, segment))}
                disabled={disabled}
                canDelete={exercise.pairs.length > 1}
                registerInput={(el) => inputs.current.set(pair.id, el)}
                onHalfChange={(half, text) => onChange(setPairHalf(exercise, pair.id, half, text))}
                onWhyChange={(why) => onChange(setWhy(exercise, pair.id, why))}
                onDelete={() => handleDelete(position - 1)}
              />
            )}
          </ReorderWithAnnouncer>

          <div>
            <Button
              type="button"
              variant="ghost"
              ref={addButton}
              disabled={disabled}
              onClick={handleAdd}
            >
              <Plus className="size-4" aria-hidden />
              {t('matchPairs.step1.addPair')}
            </Button>
          </div>
        </div>
      )}

      {tooFew !== undefined && tooFew.code === 'EX_TOO_FEW_PAIRS' && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
          <AlertCircle className="size-3.5" aria-hidden />
          {t('matchPairs.step1.errorTooFewPairs', {
            count: tooFew.pairCount,
            required: tooFew.required,
          })}
        </p>
      )}

      <div className="rounded-lg border border-border bg-[var(--ssz-bg-subtle)] px-4 py-3 text-sm">
        <p className="font-medium">{t('matchPairs.step1.tipTitle')}</p>
        <p className="mt-0.5 text-muted-foreground">
          {t('matchPairs.step1.tipBody')}{' '}
          <kbd
            className="rounded-sm border border-border px-1 py-0.5 text-xs"
            style={{ fontFamily: READING }}
          >
            {t('matchPairs.step1.tipExample')}
          </kbd>
        </p>
      </div>

      <Dialog open={pasteText !== null} onOpenChange={(open) => !open && setPasteText(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('matchPairs.step1.pasteTitle')}</DialogTitle>
            <DialogDescription>{t('matchPairs.step1.pasteHelp')}</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            value={pasteText ?? ''}
            aria-label={t('matchPairs.step1.pasteTitle')}
            placeholder={t('matchPairs.step1.pastePlaceholder')}
            style={{ fontFamily: READING }}
            onChange={(event) => setPasteText(event.target.value)}
          />

          {parsed.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border border-border p-2 text-sm">
              {parsed.slice(0, PASTE_PREVIEW_ROWS).map((line, index) => (
                <li key={index} className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <span style={{ fontFamily: READING }}>{line.left}</span>
                  {line.right === '' ? (
                    <span className="flex items-center gap-1 text-xs text-error">
                      <AlertCircle className="size-3.5" aria-hidden />
                      {t('matchPairs.step1.pasteMissingRight')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground" style={{ fontFamily: READING }}>
                      {line.right}
                    </span>
                  )}
                </li>
              ))}
              {parsed.length > PASTE_PREVIEW_ROWS && (
                <li className="text-xs text-muted-foreground">
                  {t('matchPairs.step1.pasteMore', { count: parsed.length - PASTE_PREVIEW_ROWS })}
                </li>
              )}
            </ul>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPasteText(null)}>
              {t('matchPairs.step1.cancel')}
            </Button>
            <Button type="button" disabled={parsed.length === 0} onClick={handlePaste}>
              {t('matchPairs.step1.pasteAdd', { count: parsed.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The word count behind this pair's `PAIR_RIGHT_LONG` warning, or `null` when it has none. */
function longRightWords(problems: Issue[], pairId: string): number | null {
  for (const issue of problems) {
    if (issue.code === 'PAIR_RIGHT_LONG' && issue.pairId === pairId) return issue.wordCount;
  }
  return null;
}

interface VariantChoiceProps {
  /** `null` while the teacher has not said which kind of exercise this is. */
  variant: Variant | null;
  disabled: boolean;
  onChoose: (variant: Variant) => void;
}

/**
 * Which kind of pairs this is — and it is a real question, not a display setting.
 *
 * `halves` needs an explanation on every pair to publish, because a wrong half is wrong
 * for a grammatical reason the student cannot see unaided; `pairs` only warns, because
 * the reason is on the screen already. Nothing is preselected: `pairs` is what an absent
 * field reads as, so a default here would hand the weaker rule to whoever never looked —
 * which is exactly how one of the seeded exercises came to be a `pairs` (plan 49,
 * decision 3).
 */
function VariantChoice({ variant, disabled, onChoose }: VariantChoiceProps) {
  const t = useTranslations('Authoring');

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('matchPairs.step1.variantLabel')}</p>
          <p className="text-xs text-muted-foreground">
            {variant === null
              ? t('matchPairs.step1.variantHelp')
              : variant === 'halves'
                ? t('matchPairs.step1.variantHalvesHelp')
                : t('matchPairs.step1.variantPairsHelp')}
          </p>
        </div>
        <Segmented<string>
          options={[
            { value: 'halves', label: t('matchPairs.step1.variantHalves') },
            { value: 'pairs', label: t('matchPairs.step1.variantPairs') },
          ]}
          value={variant ?? ''}
          onValueChange={(value) => !disabled && onChoose(value as Variant)}
          aria-label={t('matchPairs.step1.variantLabel')}
        />
      </div>

      {variant === null && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
          <AlertCircle className="size-3.5" aria-hidden />
          {t('matchPairs.step1.variantUnset')}
        </p>
      )}
    </div>
  );
}

interface PairCardProps {
  pair: Pair;
  index: number;
  why: string;
  /**
   * The slice of the clip this pair is heard in, or `undefined` when there is nothing to
   * time — no audio, or the author has not asked for per-item timecodes.
   */
  segment?: ItemAudio | null;
  onSegmentChange: (segment: ItemAudio | null) => void;
  halfEmpty: boolean;
  leftDuplicate: boolean;
  rightLongWords: number | null;
  disabled: boolean;
  canDelete: boolean;
  registerInput: (el: HTMLInputElement | null) => void;
  onHalfChange: (half: 'left' | 'right', text: string) => void;
  onWhyChange: (why: string) => void;
  onDelete: () => void;
}

/**
 * One pair, written whole: the two halves on one row, joined, with the answer named as
 * such. The optional note under the dashed rule is the only text here the student may
 * ever read, and only on reveal.
 */
function PairCard({
  pair,
  index,
  why,
  segment,
  onSegmentChange,
  halfEmpty,
  leftDuplicate,
  rightLongWords,
  disabled,
  canDelete,
  registerInput,
  onHalfChange,
  onWhyChange,
  onDelete,
}: PairCardProps) {
  const t = useTranslations('Authoring');

  return (
    <div className={`rounded-lg border bg-surface ${halfEmpty ? 'border-error' : 'border-border'}`}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
        <span className="flex-1" />
        {halfEmpty && (
          <span role="alert" className="flex items-center gap-1.5 text-xs text-error">
            <AlertCircle className="size-3.5" aria-hidden />
            {t('matchPairs.step1.errorHalfEmpty')}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || !canDelete}
          aria-label={t('matchPairs.step1.deletePair')}
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-error" aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {/* The clip's line for this pair. One clip for the exercise with a timecode each —
            audio on a single half is a different model and is out of this plan (§2). */}
        {segment !== undefined && (
          <AudioSegmentField segment={segment} onChange={onSegmentChange} />
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label
              className="text-[11px] font-semibold tracking-wide text-muted-foreground"
              htmlFor={`mp-left-${pair.id}`}
            >
              {t('matchPairs.step1.leftLabel')}
            </label>
            <Input
              id={`mp-left-${pair.id}`}
              ref={registerInput}
              value={pair.left}
              disabled={disabled}
              hasError={halfEmpty && pair.left.trim() === ''}
              aria-invalid={halfEmpty && pair.left.trim() === ''}
              placeholder={t('matchPairs.step1.leftPlaceholder')}
              style={{ fontFamily: READING }}
              onChange={(event) => onHalfChange('left', event.target.value)}
            />
          </div>

          <Link2
            className="mb-2.5 hidden size-4 shrink-0 text-muted-foreground sm:block"
            aria-hidden
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label
              className="text-[11px] font-semibold tracking-wide text-muted-foreground"
              htmlFor={`mp-right-${pair.id}`}
            >
              {t('matchPairs.step1.rightLabel')}
            </label>
            <Input
              id={`mp-right-${pair.id}`}
              value={pair.right}
              disabled={disabled}
              hasError={halfEmpty && pair.right.trim() === ''}
              aria-invalid={halfEmpty && pair.right.trim() === ''}
              placeholder={t('matchPairs.step1.rightPlaceholder')}
              style={{ fontFamily: READING }}
              onChange={(event) => onHalfChange('right', event.target.value)}
            />
          </div>
        </div>

        {leftDuplicate && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-warning-700">
            <AlertTriangle className="size-3.5" aria-hidden />
            {t('matchPairs.step1.warnLeftDuplicate')}
          </p>
        )}
        {rightLongWords !== null && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-warning-700">
            <AlertTriangle className="size-3.5" aria-hidden />
            {t('matchPairs.step1.warnRightLong', { count: rightLongWords })}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-dashed border-border pt-3">
          <Wand2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            value={why}
            disabled={disabled}
            aria-label={t('matchPairs.step1.whyLabel', { index: index + 1 })}
            placeholder={t('matchPairs.step1.whyPlaceholder')}
            onChange={(event) => onWhyChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
