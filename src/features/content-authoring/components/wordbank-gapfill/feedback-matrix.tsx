'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  bank,
  feedbackFor,
  gaps,
  type Gap,
  type GapKey,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import { setPairText } from './edits';
import { acceptDraft, draftFor, rejectDraft } from './ai-draft';
import { DraftAction, DraftPanel } from './draft-panel';
import { SentenceWithAnswer } from './sentence-preview';

const READING = 'var(--ssz-font-reading)';

export interface FeedbackMatrixProps {
  exercise: WordBankGapFill;
  onChange: (next: WordBankGapFill) => void;
  disabled?: boolean;
}

/** One writable pair: this gap, that wrong word. The gap's own answer is never one. */
interface Cell {
  gap: Gap;
  word: string;
}

/**
 * Step 3, matrix view: every gap against every word in the bank.
 *
 * This is what makes per-pair authoring survive a real bank. The by-gap list is the
 * better place to write one gap's feedback carefully; the matrix is for the other job —
 * seeing at a glance which of fifty pairs are written, and filling a run of them in one
 * sitting without leaving the keyboard.
 *
 * It scrolls inside its own container. A twelve-word bank is wider than the editor
 * column, and the page scrolling sideways instead would take the step rail and the
 * preview with it.
 */
export function FeedbackMatrix({ exercise, onChange, disabled = false }: FeedbackMatrixProps) {
  const t = useTranslations('Authoring');
  const allGaps = gaps(exercise);
  const words = useMemo(() => bank(exercise).map(({ word }) => word), [exercise]);

  /** Document order, row by row — the order `‹ ›` and Cmd/Ctrl+Enter walk. */
  const cells = useMemo(
    () =>
      allGaps.flatMap((gap) =>
        words.filter((word) => word !== gap.answer).map((word) => ({ gap, word })),
      ),
    [allGaps, words],
  );

  const [activeAt, setActiveAt] = useState<number | null>(null);
  const active = activeAt === null ? undefined : cells[activeAt];

  function openCell(gapKey: GapKey, word: string) {
    const at = cells.findIndex((cell) => cell.gap.key === gapKey && cell.word === word);
    setActiveAt(at === -1 ? null : at);
  }

  function step(direction: -1 | 1) {
    setActiveAt((current) => {
      if (current === null) return null;
      const next = current + direction;
      return next < 0 || next >= cells.length ? current : next;
    });
  }

  if (allGaps.length === 0 || words.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('gapFill.matrix.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The scroll lives here, not on the page (BEHAVIOR §5). */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-max border-collapse text-sm">
          <caption className="sr-only">{t('gapFill.matrix.caption')}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                {t('gapFill.matrix.gapColumn')}
              </th>
              {words.map((word) => (
                <th
                  key={word}
                  scope="col"
                  className="min-w-24 px-3 py-2 text-left text-xs font-medium"
                  style={{ fontFamily: READING }}
                >
                  {word}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allGaps.map((gap) => (
              <tr key={gap.key} className="border-t border-border">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-3 py-2 text-left align-top"
                >
                  <span className="block text-xs font-semibold">{gap.label}</span>
                  <span
                    className="block text-xs text-muted-foreground"
                    style={{ fontFamily: READING }}
                  >
                    {gap.answer}
                  </span>
                </th>

                {words.map((word) => {
                  // AC-B19: the cell where a gap meets its own answer can never hold an
                  // explanation — there is nothing wrong to explain. That is what `why`
                  // is for, in the by-gap view.
                  if (word === gap.answer) {
                    return (
                      <td key={word} className="px-3 py-2 text-center">
                        <span
                          className="inline-flex items-center gap-1 text-xs text-primary"
                          title={t('gapFill.matrix.answerCell', { label: gap.label, word })}
                        >
                          <Check className="size-3.5" aria-hidden />
                          <span className="sr-only">
                            {t('gapFill.matrix.answerCell', { label: gap.label, word })}
                          </span>
                          {t('gapFill.matrix.answerShort')}
                        </span>
                      </td>
                    );
                  }

                  const pair = feedbackFor(exercise, gap.key).pairs[word];
                  const written = pair?.origin === 'author' && pair.text.trim() !== '';
                  const isActive = active?.gap.key === gap.key && active.word === word;

                  return (
                    <td key={word} className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={
                          written
                            ? t('gapFill.matrix.editCell', { label: gap.label, word })
                            : t('gapFill.matrix.writeCell', { label: gap.label, word })
                        }
                        aria-pressed={isActive}
                        onClick={() => openCell(gap.key, word)}
                        className={`inline-flex size-7 items-center justify-center rounded-md border text-xs transition-colors focus-visible:outline-none focus-visible:shadow-focus-primary ${
                          isActive ? 'border-primary ring-1 ring-primary' : ''
                        } ${
                          written
                            ? 'border-success-300 bg-success-50 text-success-700'
                            : 'border-dashed border-border text-muted-foreground hover:bg-[var(--ssz-bg-subtle)]'
                        }`}
                      >
                        {written ? <Check className="size-3.5" aria-hidden /> : '·'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{t('gapFill.matrix.legend')}</p>

      {active !== undefined && (
        <CellEditor
          exercise={exercise}
          cell={active}
          position={{ at: (activeAt ?? 0) + 1, of: cells.length }}
          disabled={disabled}
          onChange={onChange}
          onStep={step}
          onClose={() => setActiveAt(null)}
        />
      )}
    </div>
  );
}

interface CellEditorProps {
  exercise: WordBankGapFill;
  cell: Cell;
  position: { at: number; of: number };
  disabled: boolean;
  onChange: (next: WordBankGapFill) => void;
  onStep: (direction: -1 | 1) => void;
  onClose: () => void;
}

/**
 * The editor for one pair, under the table.
 *
 * Under, not in a dialog: the point of this view is writing many pairs in a row, and a
 * modal that has to be dismissed between cells would make the matrix slower than the
 * list it exists to beat.
 */
function CellEditor({
  exercise,
  cell,
  position,
  disabled,
  onChange,
  onStep,
  onClose,
}: CellEditorProps) {
  const t = useTranslations('Authoring');
  const feedback = feedbackFor(exercise, cell.gap.key);
  const pair = feedback.pairs[cell.word];
  const text = pair?.origin === 'author' ? pair.text : '';
  const field = useRef<HTMLTextAreaElement | null>(null);

  // Focus follows the cell, including when `‹ ›` moves to the next one: the teacher
  // should be typing, not hunting for the field again.
  useEffect(() => {
    field.current?.focus();
  }, [cell.gap.key, cell.word]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">
          {t('gapFill.matrix.editorTitle', { label: cell.gap.label, word: cell.word })}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {t('gapFill.matrix.position', { at: position.at, of: position.of })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || position.at === 1}
          aria-label={t('gapFill.matrix.previousCell')}
          onClick={() => onStep(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || position.at === position.of}
          aria-label={t('gapFill.matrix.nextCell')}
          onClick={() => onStep(1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('gapFill.matrix.closeEditor')}
          onClick={onClose}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <SentenceWithAnswer gap={cell.gap} />

      <DraftPanel
        draft={draftFor(exercise, cell.gap.key, cell.word)}
        disabled={disabled}
        onAccept={() => onChange(acceptDraft(exercise, cell.gap.key, cell.word))}
        // Rewriting is accepting and then editing: the text lands in the field, and
        // what the teacher leaves there is theirs.
        onRewrite={() => onChange(acceptDraft(exercise, cell.gap.key, cell.word))}
        onReject={() => onChange(rejectDraft(exercise, cell.gap.key, cell.word))}
      />

      <Textarea
        ref={field}
        rows={3}
        value={text}
        disabled={disabled}
        aria-label={t('gapFill.matrix.editCell', { label: cell.gap.label, word: cell.word })}
        placeholder={
          feedback.fallback.trim() === ''
            ? t('gapFill.step3.pairFallsBackEmpty')
            : t('gapFill.step3.pairFallsBack', { fallback: feedback.fallback })
        }
        onChange={(event) =>
          onChange(setPairText(exercise, cell.gap.key, cell.word, event.target.value))
        }
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
          event.preventDefault();
          onStep(1);
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('gapFill.matrix.shortcutHint')}</p>
        {/* Where generation attaches for a single pair (plan 35 step 7.2). */}
        <DraftAction disabled={disabled} onDraft={() => undefined} />
      </div>
    </div>
  );
}
