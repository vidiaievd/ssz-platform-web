'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Info, Lock, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import {
  answers,
  bank,
  gaps,
  issues,
  type InputMode,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import {
  addDistractors,
  alternativesText,
  distractorProblem,
  removeDistractor,
  reusedAnswers,
  setAlternatives,
  setInputMode,
  setSettings,
  splitDistractors,
} from './edits';

const READING = 'var(--ssz-font-reading)';

export interface StepWordBankProps {
  exercise: WordBankGapFill;
  onChange: (next: WordBankGapFill) => void;
  /**
   * Words from the module's vocabulary list, offered as one-click distractors. The shell
   * fetches them; this step only shows the ones that are not already in the bank.
   */
  suggestions?: string[];
  /** Takes the teacher back to step 1, where answers are actually changed. */
  onEditGaps?: () => void;
  disabled?: boolean;
}

/**
 * Step 2 of the gap-fill builder: how the student supplies the word.
 *
 * The mode switch comes first because it decides what the rest of the step is. With a
 * bank, the answers are derived and locked — the teacher never types an answer twice —
 * and the work here is the wrong words. Typed instead, there is no bank to build, and
 * the work is which other spellings to accept.
 *
 * Switching to typing hides the bank rather than deleting it (plan step 4.2): a teacher
 * trying the other mode should find their distractors and pair explanations still there
 * on the way back. What they get instead is the `FB_PAIRS_UNUSED` warning, because pairs
 * explain a word that was chosen, and nobody chooses a word they typed.
 */
export function StepWordBank({
  exercise,
  onChange,
  suggestions = [],
  onEditGaps,
  disabled = false,
}: StepWordBankProps) {
  const t = useTranslations('Authoring');
  const allGaps = gaps(exercise);
  const bankWords = bank(exercise);
  const isBank = exercise.settings.input === 'bank';

  const modes: { value: InputMode; label: string }[] = [
    { value: 'bank', label: t('gapFill.step2.modeBank') },
    { value: 'free', label: t('gapFill.step2.modeFree') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">{t('gapFill.step2.title')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t('gapFill.step2.lede')}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <Segmented
          options={modes}
          value={exercise.settings.input}
          aria-label={t('gapFill.step2.modeLabel')}
          onValueChange={(mode) => !disabled && onChange(setInputMode(exercise, mode))}
        />
        <p className="text-xs text-muted-foreground">
          {isBank ? t('gapFill.step2.modeBankHelp') : t('gapFill.step2.modeFreeHelp')}
        </p>
      </div>

      {isBank ? (
        <BankMode
          exercise={exercise}
          onChange={onChange}
          suggestions={suggestions}
          {...(onEditGaps === undefined ? {} : { onEditGaps })}
          disabled={disabled}
        />
      ) : (
        <FreeMode exercise={exercise} onChange={onChange} disabled={disabled} />
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-medium">{t('gapFill.step2.behaviourTitle')}</p>

        {isBank && (
          <>
            <ToggleRow
              label={t('gapFill.step2.shuffle')}
              help={t('gapFill.step2.shuffleHelp')}
              checked={exercise.settings.shuffle}
              disabled={disabled}
              onChange={(shuffle) => onChange(setSettings(exercise, { shuffle }))}
            />
            <ToggleRow
              label={t('gapFill.step2.allowReuse')}
              help={t('gapFill.step2.allowReuseHelp')}
              checked={exercise.settings.allowReuse}
              disabled={disabled}
              onChange={(allowReuse) => onChange(setSettings(exercise, { allowReuse }))}
            />
            <ToggleRow
              label={t('gapFill.step2.showBankCount')}
              help={t('gapFill.step2.showBankCountHelp')}
              checked={exercise.settings.showBankCount}
              disabled={disabled}
              onChange={(showBankCount) => onChange(setSettings(exercise, { showBankCount }))}
            />
          </>
        )}

        {/* Fixed, not configurable — shown so teachers stop looking for the setting. */}
        <div className="flex items-start gap-2 rounded-md bg-[var(--ssz-bg-subtle)] px-3 py-2">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm">{t('gapFill.step2.checkingLocked')}</p>
            <p className="text-xs text-muted-foreground">{t('gapFill.step2.checkingLockedHelp')}</p>
          </div>
        </div>
      </div>

      {allGaps.length > 0 && isBank && (
        <BankSizeCallout
          exercise={exercise}
          gapCount={allGaps.length}
          bankSize={bankWords.length}
        />
      )}
    </div>
  );
}

interface BankModeProps {
  exercise: WordBankGapFill;
  onChange: (next: WordBankGapFill) => void;
  suggestions: string[];
  onEditGaps?: () => void;
  disabled: boolean;
}

function BankMode({ exercise, onChange, suggestions, onEditGaps, disabled }: BankModeProps) {
  const t = useTranslations('Authoring');
  const [draft, setDraft] = useState('');
  const allGaps = gaps(exercise);
  const correct = answers(exercise);

  /** The first word in the field that cannot be added, and why — reported before adding. */
  const rejected = splitDistractors(draft)
    .map((word) => ({ word, problem: distractorProblem(exercise, word) }))
    .find((candidate) => candidate.problem !== null);

  const canAdd = draft.trim() !== '' && rejected === undefined;
  const reused = reusedAnswers(exercise);

  const unusedSuggestions = suggestions.filter(
    (word) => distractorProblem(exercise, word) === null,
  );

  function commitDraft() {
    if (!canAdd) return;
    onChange(addDistractors(exercise, draft));
    setDraft('');
  }

  return (
    <>
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('gapFill.step2.answersTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('gapFill.step2.answersHelp')}</p>
          </div>
          {onEditGaps && (
            <Button type="button" variant="ghost" size="sm" onClick={onEditGaps}>
              {t('gapFill.step2.editGaps')}
            </Button>
          )}
        </div>

        {correct.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('gapFill.step2.answersEmpty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {correct.map((word) => {
              const labels = allGaps
                .filter((gap) => gap.answer === word)
                .map((gap) => gap.label)
                .join(', ');
              return (
                <li
                  key={word}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[var(--ssz-bg-subtle)] px-2.5 py-1 text-sm"
                  style={{ fontFamily: READING }}
                >
                  <Lock className="size-3 text-muted-foreground" aria-hidden />
                  {word}
                  <span className="text-[11px] font-semibold text-muted-foreground">{labels}</span>
                </li>
              );
            })}
          </ul>
        )}

        {reused.length > 0 && !exercise.settings.allowReuse && (
          <p className="flex items-start gap-1.5 text-xs text-warning-700" role="status">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t('gapFill.step2.reuseHint', { words: reused.join(', ') })}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium">{t('gapFill.step2.distractorsTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('gapFill.step2.distractorsHelp')}</p>
        </div>

        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              value={draft}
              disabled={disabled}
              hasError={rejected !== undefined}
              aria-invalid={rejected !== undefined}
              aria-label={t('gapFill.step2.distractorsTitle')}
              placeholder={t('gapFill.step2.distractorPlaceholder')}
              style={{ fontFamily: READING }}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commitDraft();
              }}
            />
            {rejected !== undefined && (
              <p role="alert" className="mt-1 flex items-center gap-1.5 text-xs text-error">
                <AlertCircle className="size-3.5" aria-hidden />
                {rejected.problem === 'answer'
                  ? t('gapFill.step2.distractorIsAnswer', { word: rejected.word })
                  : t('gapFill.step2.distractorExists', { word: rejected.word })}
              </p>
            )}
          </div>
          <Button type="button" disabled={disabled || !canAdd} onClick={commitDraft}>
            {t('gapFill.step2.addDistractor')}
          </Button>
        </div>

        {exercise.distractors.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {exercise.distractors.map((word) => (
              <li
                key={word}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm"
                style={{ fontFamily: READING }}
              >
                {word}
                <Button
                  type="button"
                  variant="link"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={t('gapFill.step2.removeDistractor', { word })}
                  onClick={() => onChange(removeDistractor(exercise, word))}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {unusedSuggestions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">{t('gapFill.step2.suggestionsTitle')}</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {unusedSuggestions.map((word) => (
                <li key={word}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange(addDistractors(exercise, word))}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    <span style={{ fontFamily: READING }}>{word}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

interface FreeModeProps {
  exercise: WordBankGapFill;
  onChange: (next: WordBankGapFill) => void;
  disabled: boolean;
}

/**
 * Typing instead of choosing. There is no bank to build, so the work is the spellings a
 * gap accepts beside the one in the sentence — the drills this mode absorbs are the ones
 * where two forms are both right.
 */
function FreeMode({ exercise, onChange, disabled }: FreeModeProps) {
  const t = useTranslations('Authoring');
  const allGaps = gaps(exercise);
  const unusedPairs = issues(exercise).find((issue) => issue.code === 'FB_PAIRS_UNUSED');

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium">{t('gapFill.step2.alternativesTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('gapFill.step2.alternativesHelp')}</p>
      </div>

      {unusedPairs?.code === 'FB_PAIRS_UNUSED' && (
        <p className="flex items-start gap-1.5 text-xs text-warning-700" role="status">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('gapFill.step2.pairsUnused', { count: unusedPairs.pairCount })}
        </p>
      )}

      {allGaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('gapFill.step2.answersEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {allGaps.map((gap) => (
            <li key={gap.key} className="flex flex-col gap-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor={`alt-${gap.key}`}
              >
                {t('gapFill.step2.alternativesFor', { label: gap.label, answer: gap.answer })}
              </label>
              <Input
                id={`alt-${gap.key}`}
                value={alternativesText(exercise, gap.key)}
                disabled={disabled}
                placeholder={t('gapFill.step2.alternativesPlaceholder')}
                style={{ fontFamily: READING }}
                onChange={(event) =>
                  onChange(setAlternatives(exercise, gap.key, event.target.value))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ToggleRowProps {
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, help, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

interface BankSizeCalloutProps {
  exercise: WordBankGapFill;
  gapCount: number;
  bankSize: number;
}

/**
 * How much choice the bank really offers. The amber case is the kernel's
 * `BANK_TOO_SMALL`: with words spent once, a bank barely bigger than the gap count
 * solves its own last gaps (AC-B14).
 */
function BankSizeCallout({ exercise, gapCount, bankSize }: BankSizeCalloutProps) {
  const t = useTranslations('Authoring');
  const tooSmall = issues(exercise).some((issue) => issue.code === 'BANK_TOO_SMALL');

  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
        tooSmall
          ? 'border-warning-300 bg-warning-50 text-warning-700'
          : 'border-border bg-[var(--ssz-bg-subtle)] text-[var(--ssz-text-secondary)]'
      }`}
      role="status"
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        {tooSmall
          ? t('gapFill.step2.bankTooSmall', { bankSize, gapCount })
          : t('gapFill.step2.bankOk', { bankSize, gapCount })}
      </p>
    </div>
  );
}
