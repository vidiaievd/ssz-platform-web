'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import {
  completePairs,
  feedbackFor,
  rightItems,
  type MatchPairs,
} from '@/lib/shared-kernel/match-pairs';

import { FeedbackMatrix as Matrix, type MatrixCopy } from '../feedback-matrix';
import { overrideText, setOverride } from './edits';
import { SolvedPair } from './solved-pair';

const READING = 'var(--ssz-font-reading)';

export interface MatchPairsMatrixProps {
  exercise: MatchPairs;
  onChange: (next: MatchPairs) => void;
  disabled?: boolean;
}

/**
 * Step 3, matrix view: every pair against every half in the pool.
 *
 * The table is `components/feedback-matrix.tsx`, shared with `word_bank_gap_fill`. What
 * belongs here is what a row and a column are for this type: a row is a pair keyed by
 * `PairId`, a column is a pool half keyed by `RightId`, and the two never share an id —
 * which is exactly why the row's own answer column has to be named rather than guessed.
 */
export function MatchPairsMatrix({ exercise, onChange, disabled = false }: MatchPairsMatrixProps) {
  const t = useTranslations('Authoring');
  const pairs = completePairs(exercise);
  const pool = useMemo(() => rightItems(exercise), [exercise]);
  const reading = exercise.variant === 'halves' ? READING : undefined;

  const rows = useMemo(
    () =>
      pairs.map((pair, index) => ({
        id: pair.id,
        label: `${index + 1}. ${pair.left}`,
        answerColumnId: pair.rightId,
        header: (
          <>
            <span className="block text-xs font-semibold">{index + 1}</span>
            <span
              className="block max-w-40 truncate text-xs text-muted-foreground"
              style={{ fontFamily: reading }}
              title={pair.left}
            >
              {pair.left}
            </span>
          </>
        ),
      })),
    [pairs, reading],
  );

  const columns = useMemo(() => pool.map((item) => ({ id: item.id, label: item.text })), [pool]);

  const copy: MatrixCopy = {
    caption: t('matchPairs.matrix.caption'),
    rowColumn: t('matchPairs.matrix.pairColumn'),
    legend: t('matchPairs.matrix.legend'),
    answerShort: t('matchPairs.matrix.answerShort'),
    answerCell: (pair, half) => t('matchPairs.matrix.answerCell', { pair, half }),
    writeCell: (pair, half) => t('matchPairs.matrix.writeCell', { pair, half }),
    editCell: (pair, half) => t('matchPairs.matrix.editCell', { pair, half }),
    editorTitle: (pair, half) => t('matchPairs.matrix.editorTitle', { pair, half }),
    position: (at, of) => t('matchPairs.matrix.position', { at, of }),
    previousCell: t('matchPairs.matrix.previousCell'),
    nextCell: t('matchPairs.matrix.nextCell'),
    closeEditor: t('matchPairs.matrix.closeEditor'),
    shortcutHint: t('matchPairs.matrix.shortcutHint'),
  };

  if (pairs.length === 0 || pool.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('matchPairs.matrix.empty')}</p>;
  }

  return (
    <Matrix
      rows={rows}
      columns={columns}
      copy={copy}
      columnFont={reading}
      disabled={disabled}
      textFor={(pairId, rightId) => overrideText(exercise, pairId, rightId)}
      onCellChange={(pairId, rightId, text) =>
        onChange(setOverride(exercise, pairId, rightId, text))
      }
      // AC-B22: the pair's current default, so the teacher sees what the student would
      // otherwise be told and can leave the cell empty on purpose.
      placeholderFor={(pairId) => {
        const def = feedbackFor(exercise, pairId).def;
        return def.trim() === ''
          ? t('matchPairs.step3.fallsBackEmpty')
          : t('matchPairs.step3.fallsBack', { def });
      }}
      // AC-B21: both halves named — the sentence the student would be building.
      renderCellExtra={(pairId, rightId) => {
        const pair = pairs.find((candidate) => candidate.id === pairId);
        const half = pool.find((item) => item.id === rightId);
        if (pair === undefined || half === undefined) return null;
        return <SolvedPair left={pair.left} right={half.text} variant={exercise.variant} wrong />;
      }}
    />
  );
}
