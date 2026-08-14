'use client';

import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type {
  DiffToken,
  ProjectedItem,
  SelfCheckFeedback,
  SelfCheckItem,
  StudentProjection,
} from '@/lib/shared-kernel/translate';

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
  /**
   * The last self-check the server answered, if the learner asked for one. It carries a
   * verdict and a word-level diff per sentence — with every word of the key the learner
   * has not written already replaced by `•••` on the server, unless the key is about to
   * be shown anyway (BEHAVIOR.md, "Само-проверка"). The browser masks nothing itself,
   * because a browser that could would have been sent the key to mask.
   */
  selfCheck?: SelfCheckFeedback | null;
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
  selfCheck = null,
}: TranslateRunnerBodyProps) {
  const t = useTranslations('ExerciseRunner');
  const interactive = phase === 'answering';
  const { items, flow } = projection;

  const selfCheckByItem = useMemo(() => {
    const byItem = new Map<string, SelfCheckItem>();
    for (const item of selfCheck?.items ?? []) byItem.set(item.itemId, item);
    return byItem;
  }, [selfCheck]);

  /** The legend belongs to the diff, so it appears only when a diff is on screen. */
  const anyDiff = useMemo(
    () => (selfCheck?.items ?? []).some((item) => (item.tokens?.length ?? 0) > 0),
    [selfCheck],
  );

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

      {interactive && anyDiff && <TrDiffLegend />}

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
            feedback={selfCheckByItem.get(item.id) ?? null}
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
  /** This sentence in the last self-check, if one was asked for. */
  feedback: SelfCheckItem | null;
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
  feedback,
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

      {interactive && feedback !== null && (
        <TrSelfCheckNote
          feedback={feedback}
          hasHint={item.hint !== undefined && item.hint !== ''}
        />
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

interface TrSelfCheckNoteProps {
  feedback: SelfCheckItem;
  /** Whether this sentence has a hint to send the learner back to. */
  hasHint: boolean;
}

/**
 * What one sentence's self-check is allowed to say, before anything is handed in.
 *
 * The four wordings follow the verdict and stop where the engine stops: `exact` is the
 * only one that reports a result, and the other three report a *distance from the key* —
 * not a judgement. A translation this template calls `off` is very often a second good
 * translation the author never wrote down, so nothing here says "wrong".
 *
 * The one thing it may say is wrong is a guard: `require` and `forbid` are statements
 * about the task ("this exercise practises «har bodd»"), not about the key, and the
 * author's own note travels with each of them.
 */
function TrSelfCheckNote({ feedback, hasHint }: TrSelfCheckNoteProps) {
  const t = useTranslations('ExerciseRunner');
  const { verdict, tokens, divergingWords, missing, banned } = feedback;

  // Nothing written yet: the learner knows, and a panel saying so is one more thing to
  // read on a card they have not started.
  if (verdict === 'empty') return null;

  const ok = verdict === 'exact';
  const headline =
    verdict === 'exact'
      ? t('translate.selfCheck.exact')
      : verdict === 'typo'
        ? t('translate.selfCheck.typo')
        : verdict === 'near'
          ? t('translate.selfCheck.near')
          : verdict === 'off'
            ? t('translate.selfCheck.off')
            : // `noref`: the author left this sentence without an accepted translation, so
              // there is nothing to be close to. Neither the distance nor the blame is
              // the learner's to hear about.
              t('translate.selfCheck.noKey');

  return (
    <div
      className="mt-2 rounded-xl border px-3 py-2"
      style={{
        borderColor: ok ? 'var(--ssz-feedback-ok-line)' : 'var(--ssz-border-default)',
        background: ok ? 'var(--ssz-feedback-ok-bg)' : 'var(--ssz-bg-surface-subtle)',
      }}
    >
      <p
        className="text-[12.5px] font-semibold"
        style={{ color: ok ? 'var(--ssz-feedback-ok-fg)' : 'var(--ssz-text-primary)' }}
      >
        {headline}
      </p>

      {tokens !== undefined && tokens.length > 0 && <TrDiffLine tokens={tokens} />}

      {/* `off` gets a count instead of a diff: at that distance the diff is mostly the
          key's own words, and a wall of `•••` teaches nothing. */}
      {divergingWords !== undefined && (
        <p className="mt-1 text-[12px] text-(--ssz-text-secondary)">
          {hasHint
            ? t('translate.selfCheck.divergingWithHint', { count: divergingWords })
            : t('translate.selfCheck.diverging', { count: divergingWords })}
        </p>
      )}

      {missing.map((guard, index) => (
        <p key={`m${index}`} className="mt-1 text-[12px] text-(--ssz-text-secondary)">
          {t('translate.selfCheck.requires', { text: guard.text })}
          {guard.note !== undefined && guard.note !== '' && ` — ${guard.note}`}
        </p>
      ))}
      {banned.map((guard, index) => (
        <p key={`b${index}`} className="mt-1 text-[12px] text-(--ssz-text-secondary)">
          {t('translate.selfCheck.avoid', { text: guard.text })}
          {guard.note !== undefined && guard.note !== '' && ` — ${guard.note}`}
        </p>
      ))}
    </div>
  );
}

/**
 * The word-level diff against the closest accepted translation.
 *
 * Words of the key the learner has not written arrive already masked — the server does
 * it, and this component never sees the words behind the mask. Colour is doubled by
 * shape throughout (struck through for a surplus word, underlined for one from the key,
 * dotted for a spelling slip), so the diff is readable without seeing colour.
 */
function TrDiffLine({ tokens }: { tokens: DiffToken[] }) {
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1" style={{ fontFamily: READING }}>
      {tokens.map((token, index) => (
        <span key={index} className="text-[14.5px]" style={diffStyle(token)}>
          {token.w}
        </span>
      ))}
    </p>
  );
}

/** How one diff word is drawn. `eq` with a `typo` is a hit reached by one letter's grace. */
function diffStyle(token: DiffToken): CSSProperties {
  if (token.t === 'extra') {
    return { color: 'var(--ssz-feedback-no-fg)', textDecoration: 'line-through' };
  }
  if (token.t === 'missing') {
    return {
      color: 'var(--ssz-feedback-ok-fg)',
      textDecoration: 'underline',
      textUnderlineOffset: 3,
    };
  }
  if (token.typo !== null) {
    return {
      color: 'var(--ssz-text-primary)',
      textDecoration: 'underline dotted',
      textUnderlineOffset: 3,
    };
  }
  return { color: 'var(--ssz-text-secondary)' };
}

/** What the three markings of the diff mean, drawn in the markings themselves. */
function TrDiffLegend() {
  const t = useTranslations('ExerciseRunner');
  return (
    <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-(--ssz-text-muted)">
      <span style={diffStyle({ t: 'extra', w: '', typo: null })}>
        {t('translate.selfCheck.legendExtra')}
      </span>
      <span style={diffStyle({ t: 'missing', w: '', typo: null })}>
        {t('translate.selfCheck.legendMissing')}
      </span>
      <span style={diffStyle({ t: 'eq', w: '', typo: 'x' })}>
        {t('translate.selfCheck.legendTypo')}
      </span>
    </p>
  );
}
