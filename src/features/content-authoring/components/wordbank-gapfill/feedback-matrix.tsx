'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import {
  bank,
  feedbackFor,
  gaps,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

import { FeedbackMatrix as Matrix, type MatrixCopy } from '../feedback-matrix';
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

/**
 * Step 3, matrix view: every gap against every word in the bank.
 *
 * The table itself is `components/feedback-matrix.tsx`, shared with `match_pairs`; what
 * belongs here is what a row and a column mean for this type — a gap keyed by its
 * `GapKey`, a column keyed by the word itself, and the pair text stored under that word.
 */
export function FeedbackMatrix({ exercise, onChange, disabled = false }: FeedbackMatrixProps) {
  const t = useTranslations('Authoring');
  const allGaps = gaps(exercise);
  const words = useMemo(() => bank(exercise).map(({ word }) => word), [exercise]);

  const rows = useMemo(
    () =>
      allGaps.map((gap) => ({
        id: gap.key,
        label: gap.label,
        answerColumnId: gap.answer,
        header: (
          <>
            <span className="block text-xs font-semibold">{gap.label}</span>
            <span className="block text-xs text-muted-foreground" style={{ fontFamily: READING }}>
              {gap.answer}
            </span>
          </>
        ),
      })),
    [allGaps],
  );

  const columns = useMemo(() => words.map((word) => ({ id: word, label: word })), [words]);

  const copy: MatrixCopy = {
    caption: t('gapFill.matrix.caption'),
    rowColumn: t('gapFill.matrix.gapColumn'),
    legend: t('gapFill.matrix.legend'),
    answerShort: t('gapFill.matrix.answerShort'),
    answerCell: (label, word) => t('gapFill.matrix.answerCell', { label, word }),
    writeCell: (label, word) => t('gapFill.matrix.writeCell', { label, word }),
    editCell: (label, word) => t('gapFill.matrix.editCell', { label, word }),
    editorTitle: (label, word) => t('gapFill.matrix.editorTitle', { label, word }),
    position: (at, of) => t('gapFill.matrix.position', { at, of }),
    previousCell: t('gapFill.matrix.previousCell'),
    nextCell: t('gapFill.matrix.nextCell'),
    closeEditor: t('gapFill.matrix.closeEditor'),
    shortcutHint: t('gapFill.matrix.shortcutHint'),
  };

  if (allGaps.length === 0 || words.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('gapFill.matrix.empty')}</p>;
  }

  /** An AI draft is not an explanation until a human accepts it, so it is not text yet. */
  function authored(gapKey: string, word: string): string {
    const pair = feedbackFor(exercise, gapKey).pairs[word];
    return pair?.origin === 'author' ? pair.text : '';
  }

  return (
    <Matrix
      rows={rows}
      columns={columns}
      copy={copy}
      columnFont={READING}
      disabled={disabled}
      textFor={authored}
      onCellChange={(gapKey, word, text) => onChange(setPairText(exercise, gapKey, word, text))}
      placeholderFor={(gapKey) => {
        const fallback = feedbackFor(exercise, gapKey).fallback;
        return fallback.trim() === ''
          ? t('gapFill.step3.pairFallsBackEmpty')
          : t('gapFill.step3.pairFallsBack', { fallback });
      }}
      renderCellExtra={(gapKey, word) => {
        const gap = allGaps.find((candidate) => candidate.key === gapKey);
        if (gap === undefined) return null;
        return (
          <>
            <SentenceWithAnswer gap={gap} />
            <DraftPanel
              draft={draftFor(exercise, gapKey, word)}
              disabled={disabled}
              onAccept={() => onChange(acceptDraft(exercise, gapKey, word))}
              // Rewriting is accepting and then editing: the text lands in the field, and
              // what the teacher leaves there is theirs.
              onRewrite={() => onChange(acceptDraft(exercise, gapKey, word))}
              onReject={() => onChange(rejectDraft(exercise, gapKey, word))}
            />
          </>
        );
      }}
      // Where generation attaches for a single pair (plan 35 step 7.2).
      editorFooter={<DraftAction disabled={disabled} onDraft={() => undefined} />}
    />
  );
}
