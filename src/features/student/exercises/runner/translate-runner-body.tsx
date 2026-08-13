'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { ProjectedItem, StudentProjection } from '@/lib/shared-kernel/translate';

import { CharPad } from '@/components/shared/char-pad';

import { Instr } from './instr';
import { modeAccentSoft, type RunnerMode, type RunnerPhase } from './types';

/** itemId → what the learner wrote for that sentence. */
export type TranslateValue = Record<string, string>;

/** Where each sentence ended up, once the work has been handed in. */
export type TranslateRouting = Record<string, 'pass' | 'teacher'>;

export interface TranslateRunnerBodyProps {
  /**
   * The exercise as it left the server: the sentences to translate, the languages they
   * are read and written in, and the flow settings. It carries no accepted translation —
   * for this template the key *is* the answer, so it never reaches the browser.
   */
  projection: StudentProjection;
  instruction?: string;
  value: TranslateValue;
  onValueChange: (value: TranslateValue) => void;
  /** Reports whether every sentence has been written, which is what allows submitting. */
  onAnswerChange: (canSubmit: boolean) => void;
  phase: RunnerPhase;
  mode: RunnerMode;
  accent: string;
  /**
   * Set while the runner is pointing out the sentences still empty — the learner pressed
   * the primary action too early.
   */
  pointOut?: boolean;
  /**
   * After handing in: which sentences the auto-check closed on a hit, and which went to
   * a teacher. The server decides it — the browser has nothing to decide it with.
   */
  routing?: TranslateRouting | null;
}

const READING = 'var(--ssz-font-reading)';

/** The letters an English or a US layout does not have — `flow.keyboard`. */
const NORWEGIAN_CHARS = ['æ', 'ø', 'å'] as const;

const answerOf = (value: TranslateValue, itemId: string): string => value[itemId] ?? '';

const isWritten = (text: string): boolean => text.trim() !== '';

/**
 * `translate_to_target` / `translate_from_target` as the learner plays them: a set of
 * sentences, one submission, and — until a teacher has read it — no verdict.
 *
 * The screen deliberately says less after handing in than the other templates do. The
 * auto-check of this template may only ever approve (BEHAVIOR.md, "Дизайн-решения" §1):
 * a translation that misses the key is very often a second good translation the author
 * never wrote down. So a sentence is either identical to a variant of the key, and
 * closed, or it is with a teacher — and this component never invents the third answer.
 */
export function TranslateRunnerBody({
  projection,
  instruction,
  value,
  onValueChange,
  onAnswerChange,
  phase,
  mode,
  accent,
  pointOut = false,
  routing = null,
}: TranslateRunnerBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const interactive = phase === 'answering';
  const { items, flow } = projection;

  const writtenCount = useMemo(
    () => items.filter((item) => isWritten(answerOf(value, item.id))).length,
    [items, value],
  );

  useEffect(() => {
    onAnswerChange(items.length > 0 && writtenCount === items.length);
  }, [onAnswerChange, items.length, writtenCount]);

  /** The whole set at once, so the badge reads the same as the header. */
  const heading =
    projection.dir === 'both'
      ? t('translate.bothWays')
      : t('translate.direction', {
          from: items[0]?.sourceLang ?? projection.langs.explain,
          to: items[0]?.answerLang ?? projection.langs.target,
        });

  return (
    <div>
      {instruction !== undefined && instruction !== '' && <Instr>{instruction}</Instr>}

      <p className="mb-2 text-[12px] font-bold tracking-wide text-(--ssz-text-muted) uppercase">
        {heading}
      </p>

      {projection.note !== '' && interactive && (
        <p className="mb-3 text-[13px] text-(--ssz-text-secondary)">{projection.note}</p>
      )}

      {items.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <span
            aria-hidden
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: 'var(--ssz-border-default)' }}
          >
            <i
              className="block h-full rounded-full transition-[width]"
              style={{ width: `${(writtenCount / items.length) * 100}%`, background: accent }}
            />
          </span>
          <span className="text-[12.5px] text-(--ssz-text-muted)">
            {t('translate.progress', { written: writtenCount, total: items.length })}
          </span>
        </div>
      )}

      <ol className="flex flex-col gap-4">
        {items.map((item, index) => (
          <TrCard
            key={item.id}
            item={item}
            number={items.length > 1 ? index + 1 : null}
            showDirection={projection.dir === 'both'}
            answer={answerOf(value, item.id)}
            keyboard={flow.keyboard}
            gloss={flow.gloss}
            charCount={flow.charCount}
            interactive={interactive}
            accent={accent}
            mode={mode}
            empty={pointOut && !isWritten(answerOf(value, item.id))}
            outcome={routing?.[item.id] ?? null}
            onAnswerChange={(text) => onValueChange({ ...value, [item.id]: text })}
          />
        ))}
      </ol>
    </div>
  );
}

interface TrCardProps {
  item: ProjectedItem;
  /** `null` for a single-sentence exercise, where a number would only be furniture. */
  number: number | null;
  showDirection: boolean;
  answer: string;
  keyboard: boolean;
  gloss: boolean;
  charCount: boolean;
  interactive: boolean;
  accent: string;
  mode: RunnerMode;
  empty: boolean;
  outcome: 'pass' | 'teacher' | null;
  onAnswerChange: (text: string) => void;
}

/** One sentence: what to translate, the field to translate it in, and its tools. */
function TrCard({
  item,
  number,
  showDirection,
  answer,
  keyboard,
  gloss,
  charCount,
  interactive,
  accent,
  mode,
  empty,
  outcome,
  onAnswerChange,
}: TrCardProps) {
  const t = useTranslations('ExerciseRunner');
  const [hintOpen, setHintOpen] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  const border =
    outcome === 'pass'
      ? 'var(--ssz-feedback-ok-line)'
      : empty
        ? accent
        : 'var(--ssz-border-default)';

  return (
    <li
      className="rounded-2xl border px-4 py-3 transition-colors"
      style={{
        borderColor: border,
        background: empty ? modeAccentSoft(mode) : 'var(--ssz-bg-surface)',
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[12px] font-bold text-(--ssz-text-muted)">
          {number === null
            ? showDirection
              ? t('translate.direction', { from: item.sourceLang, to: item.answerLang })
              : item.sourceLang
            : showDirection
              ? t('translate.numberedDirection', {
                  n: number,
                  from: item.sourceLang,
                  to: item.answerLang,
                })
              : t('translate.numberedLang', { n: number, lang: item.sourceLang })}
        </span>
        {outcome !== null && (
          <span
            className="text-[12px] font-semibold"
            style={{
              color: outcome === 'pass' ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-text-secondary)',
            }}
          >
            {outcome === 'pass' ? t('translate.itemApproved') : t('translate.itemWithTeacher')}
          </span>
        )}
      </div>

      <p
        className="mb-2"
        style={{ fontFamily: READING, fontSize: 18, lineHeight: 1.5, fontWeight: 600 }}
      >
        {item.source}
      </p>

      {/* The author's word notes. They go with the sentence, not with the answer, so
          they close when the work is handed in and the reading is over. */}
      {gloss && item.gloss !== undefined && item.gloss.length > 0 && interactive && (
        <p className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-(--ssz-text-secondary)">
          {item.gloss.map((entry, index) => (
            <span key={index}>
              <b>{entry.w}</b> — {entry.t}
            </span>
          ))}
        </p>
      )}

      <textarea
        ref={field}
        rows={2}
        value={answer}
        readOnly={!interactive}
        aria-label={t('translate.fieldLabel', { n: number ?? 1 })}
        placeholder={t('translate.placeholder', { lang: item.answerLang.toLowerCase() })}
        onChange={(event) => onAnswerChange(event.target.value)}
        className="w-full rounded-xl border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
        style={{
          fontFamily: READING,
          fontSize: 17,
          lineHeight: 1.5,
          resize: 'none',
          borderColor: 'var(--ssz-border-default)',
          background: interactive ? 'var(--ssz-bg-base)' : 'var(--ssz-bg-surface-subtle)',
          color: 'var(--ssz-text-primary)',
        }}
      />

      {interactive && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* Only when the answer is written in the language that needs them: on the way
              back out of Norwegian the pad would offer letters the answer has no use for. */}
          {keyboard && item.dir === 'to_target' && (
            <CharPad
              chars={NORWEGIAN_CHARS}
              label={t('errorCorrection.charPad')}
              onInsert={() => field.current?.focus()}
            />
          )}
          {item.hint !== undefined && item.hint !== '' && (
            <button
              type="button"
              onClick={() => setHintOpen((open) => !open)}
              className="text-[12px] font-semibold underline underline-offset-2"
              style={{ color: 'var(--ssz-text-secondary)' }}
            >
              {hintOpen ? t('translate.hideHint') : t('errorCorrection.showHint')}
            </button>
          )}
          <span className="flex-1" />
          {charCount && (
            <span className="text-[12px] text-(--ssz-text-muted)">
              {t('translate.chars', { count: answer.length })}
            </span>
          )}
        </div>
      )}

      {hintOpen && item.hint !== undefined && item.hint !== '' && (
        <p className="mt-2 text-[12.5px] text-(--ssz-text-secondary)">{item.hint}</p>
      )}

      {outcome === 'pass' && (
        <p className="mt-2 text-[12.5px] text-(--ssz-feedback-ok-fg)">
          {t('translate.itemApprovedWhy')}
        </p>
      )}
      {outcome === 'teacher' && (
        <p className="mt-2 text-[12.5px] text-(--ssz-text-secondary)">
          {t('translate.itemWithTeacherWhen')}
        </p>
      )}
    </li>
  );
}
