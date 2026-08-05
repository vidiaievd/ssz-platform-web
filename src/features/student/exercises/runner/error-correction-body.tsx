'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Instr } from './instr';
import { type RunnerMode, type RunnerPhase } from './types';

export interface ErrorChunk {
  id: string;
  text: string;
}

export interface ErrorSentence {
  id: string;
  chunks: ErrorChunk[];
}

export interface ErrorCorrectionContent {
  items: ErrorSentence[];
  /** How many chunks are faulty — tells the learner when to stop looking. */
  mistakeCount?: number;
  instruction?: string;
}

export interface ErrorCorrectionExpected {
  corrections: Array<{
    item_id: string;
    chunk_id: string;
    accepted: string[];
    note?: string;
  }>;
  explanation?: string;
}

/** itemId → chunkId → the learner's rewrite (only chunks they actually changed). */
export type ErrorCorrectionValue = Record<string, Record<string, string>>;

export type ChunkOutcome = 'fixed' | 'wrong_fix' | 'missed' | 'false_positive';

export interface ChunkResult {
  outcome: ChunkOutcome;
  /** The accepted rewrite, shown when the learner missed it or got it wrong. */
  expected?: string;
  note?: string;
}

/** itemId → chunkId → outcome; only present in the feedback phase. */
export type ErrorCorrectionResults = Record<string, Record<string, ChunkResult>>;

export interface ErrorCorrectionBodyProps {
  content: ErrorCorrectionContent;
  value: ErrorCorrectionValue;
  onValueChange: (value: ErrorCorrectionValue) => void;
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  /** null in graded mode — the body never reveals correctness there. */
  ok: boolean | null;
  mode: RunnerMode;
  accent: string;
  results?: ErrorCorrectionResults;
}

const READING = 'var(--ssz-font-reading)';

const OUTCOME_TONE: Record<ChunkOutcome, { border: string; bg: string; fg: string }> = {
  fixed: {
    border: 'var(--ssz-feedback-ok-line)',
    bg: 'var(--ssz-feedback-ok-bg)',
    fg: 'var(--ssz-feedback-ok-fg)',
  },
  wrong_fix: {
    border: 'var(--ssz-feedback-no-line)',
    bg: 'var(--ssz-feedback-no-bg)',
    fg: 'var(--ssz-feedback-no-fg)',
  },
  missed: {
    border: 'var(--ssz-border-accent-warm)',
    bg: 'var(--ssz-bg-accent-warm)',
    fg: 'var(--ssz-text-accent-warm)',
  },
  false_positive: {
    border: 'var(--ssz-feedback-no-line)',
    bg: 'var(--ssz-bg-surface)',
    fg: 'var(--ssz-feedback-no-fg)',
  },
};

export function ErrorCorrectionBody({
  content,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  ok,
  accent,
  results,
}: ErrorCorrectionBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const reveal = phase === 'feedback';
  const [editing, setEditing] = useState<string | null>(null);

  const editCount = Object.values(value).reduce((n, byChunk) => n + Object.keys(byChunk).length, 0);

  useEffect(() => {
    onAnswerChange(editCount > 0);
  }, [editCount, onAnswerChange]);

  /** An edit equal to the original text is no edit at all, so it is dropped. */
  function setChunk(itemId: string, chunk: ErrorChunk, text: string) {
    const byChunk = { ...(value[itemId] ?? {}) };
    if (text.trim() === '' || text.trim() === chunk.text.trim()) {
      delete byChunk[chunk.id];
    } else {
      byChunk[chunk.id] = text;
    }
    const next = { ...value, [itemId]: byChunk };
    if (Object.keys(byChunk).length === 0) delete next[itemId];
    onValueChange(next);
  }

  return (
    <div>
      {content.instruction && <Instr>{content.instruction}</Instr>}

      {content.mistakeCount != null && !reveal && (
        <p className="mb-4 text-[13px] text-(--ssz-text-secondary)">
          {t('errorCorrection.remaining', { found: editCount, total: content.mistakeCount })}
        </p>
      )}

      <ol className="flex flex-col gap-4">
        {content.items.map((item, i) => (
          <li key={item.id} className="flex gap-2.5">
            <span className="pt-1.5 text-[13px] font-semibold text-(--ssz-text-muted)">{i + 1}.</span>
            <p className="flex flex-wrap items-center gap-1.5">
              {item.chunks.map((chunk) => {
                const edited = value[item.id]?.[chunk.id];
                const result = reveal && ok !== null ? results?.[item.id]?.[chunk.id] : undefined;
                const tone = result ? OUTCOME_TONE[result.outcome] : null;
                const isEditing = editing === `${item.id} ${chunk.id}`;

                if (isEditing && !reveal) {
                  return (
                    <input
                      key={chunk.id}
                      autoFocus
                      defaultValue={edited ?? chunk.text}
                      aria-label={t('errorCorrection.editLabel', { text: chunk.text })}
                      onBlur={(e) => {
                        setChunk(item.id, chunk, e.target.value);
                        setEditing(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      size={Math.max(8, (edited ?? chunk.text).length)}
                      className="rounded-lg border-2 px-2 py-1 text-[15px] focus-visible:outline-none"
                      style={{ fontFamily: READING, borderColor: accent }}
                    />
                  );
                }

                return (
                  <span key={chunk.id} className="inline-flex items-baseline gap-1.5">
                    <button
                      type="button"
                      disabled={reveal}
                      onClick={() => setEditing(`${item.id} ${chunk.id}`)}
                      className="rounded-lg border px-2 py-1 text-[15px] transition-colors disabled:cursor-default"
                      style={{
                        fontFamily: READING,
                        borderColor: tone?.border ?? (edited ? accent : 'var(--ssz-border-default)'),
                        background: tone?.bg ?? 'var(--ssz-bg-surface)',
                        color: tone?.fg ?? 'var(--ssz-text-primary)',
                        fontWeight: edited || tone ? 600 : 400,
                        textDecoration: result?.outcome === 'false_positive' ? 'line-through' : undefined,
                      }}
                    >
                      {edited ?? chunk.text}
                    </button>
                    {/* The answer key's wording, shown where the learner missed
                        the mistake or rewrote it into something else. */}
                    {result?.expected &&
                      (result.outcome === 'missed' || result.outcome === 'wrong_fix') && (
                        <span
                          className="text-[13.5px] font-semibold"
                          style={{ color: OUTCOME_TONE.fixed.fg }}
                        >
                          {result.expected}
                        </span>
                      )}
                  </span>
                );
              })}
            </p>
          </li>
        ))}
      </ol>

      {!reveal && (
        <p className="mt-4 text-[12.5px] text-(--ssz-text-muted)">{t('errorCorrection.hint')}</p>
      )}
    </div>
  );
}
