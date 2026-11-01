'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  accuracyBand,
  checksLeft,
  noticeOf,
  wordsByPassage,
  type AccuracyBand,
} from './capability';
import type { Feedback, FeedbackItem, PrecheckResult } from './types';

const BAND_CLASS: Record<AccuracyBand, string> = {
  good: 'border-(--ssz-text-accent) bg-(--ssz-bg-accent)',
  fair: 'border-(--ssz-border-strong)',
  low: 'border-dashed border-(--ssz-border-default) opacity-80',
};

export interface PrecheckPanelProps {
  result: PrecheckResult;
  /** Names a passage of a reading by its place in the exercise (0-based); absent for a text. */
  passageLabel?: (passageIndex: number) => string;
  /** Names a passage by its id, for the share of it read. */
  itemLabel?: (itemId: string) => string;
  /**
   * The passages that were sent. The engine reports the whole exercise, and a passage not
   * recorded yet would read as «0%» — which is not what was heard, so only these are drawn.
   */
  heardItemIds?: ReadonlySet<string>;
}

/**
 * What a model said about work not yet handed in (platform plan 84, web step 8).
 *
 * A rehearsal, not a mark: the panel says so under its title (Q5 — the grade is the
 * teacher's), draws the remarks of a text or the words heard of a reading, and says how many
 * checks are left. Colour carries no verdict: a well-read word is lit with the accent, a poor
 * one is dimmed and dashed.
 */
export function PrecheckPanel({
  result,
  passageLabel,
  itemLabel,
  heardItemIds,
}: PrecheckPanelProps) {
  const t = useTranslations('ExerciseRunner.precheck');
  const notice = noticeOf(result);
  if (notice.kind === 'none') return null;

  const left = checksLeft(result.remaining);
  const readings = (result.reading?.prompts ?? []).filter(
    (prompt) => heardItemIds === undefined || heardItemIds.has(prompt.itemId),
  );

  return (
    <section
      aria-label={t('title')}
      aria-live="polite"
      className="mt-4 flex flex-col gap-3 rounded-[11px] border-[1.5px] border-dashed border-(--ssz-border-strong) bg-(--ssz-bg-surface) px-3.5 py-3"
    >
      <header>
        <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.07em] text-(--ssz-text-accent)">
          <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {t('title')}
        </p>
        <p className="mt-1 text-[12.5px] text-(--ssz-text-muted)">{t('subtitle')}</p>
      </header>

      {notice.kind === 'line' ? (
        <p className="text-[14px] text-(--ssz-text-primary)">{t(`line.${notice.key}`)}</p>
      ) : (
        <>
          {readings.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {readings.map((prompt, i) => (
                <li
                  key={prompt.itemId}
                  className={`rounded-full border-[1.5px] px-2.5 py-0.5 text-[12.5px] ${
                    prompt.passed
                      ? 'border-(--ssz-text-accent) text-(--ssz-text-accent)'
                      : 'border-(--ssz-border-default) text-(--ssz-text-secondary)'
                  }`}
                >
                  {itemLabel ? itemLabel(prompt.itemId) : String(i + 1)} · {prompt.percent}%
                </li>
              ))}
            </ul>
          )}
          {result.feedback !== null && (
            <FeedbackBody feedback={result.feedback} {...(passageLabel ? { passageLabel } : {})} />
          )}
        </>
      )}

      {left !== null && (
        <p className="text-[12px] text-(--ssz-text-muted)">{t('left', { count: left })}</p>
      )}
    </section>
  );
}

function FeedbackBody({
  feedback,
  passageLabel,
}: {
  feedback: Feedback;
  passageLabel?: (passageIndex: number) => string;
}) {
  const t = useTranslations('ExerciseRunner.precheck');
  const groups = wordsByPassage(feedback);
  const scored = feedback.words.some((w) => w.accuracy !== null);

  return (
    <>
      {feedback.summary.trim() !== '' && (
        <p className="text-[14px] leading-relaxed text-(--ssz-text-primary)">{feedback.summary}</p>
      )}

      {groups.map((group, g) => (
        <div key={`${group.passageIndex}-${g}`} className="flex flex-col gap-1.5">
          {group.passageIndex !== null && passageLabel && groups.length > 1 && (
            <p className="text-[12px] font-semibold text-(--ssz-text-muted)">
              {passageLabel(group.passageIndex)}
            </p>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {group.words.map((word, i) => (
              <li
                key={`${word.text}-${i}`}
                className={`flex flex-col items-center rounded-lg border-[1.5px] px-2 py-0.5 ${
                  word.accuracy !== null
                    ? BAND_CLASS[accuracyBand(word.accuracy)]
                    : 'border-(--ssz-border-default)'
                }`}
              >
                <span className="text-[15px] text-(--ssz-text-primary)">{word.text}</span>
                {word.accuracy !== null && (
                  <span className="text-[10.5px] text-(--ssz-text-muted)">
                    {Math.round(word.accuracy)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups.length > 0 && !scored && (
        <p className="text-[12.5px] text-(--ssz-text-muted)">{t('noScores')}</p>
      )}

      {feedback.items.length === 0 && groups.length === 0 && (
        <p className="text-[14px] text-(--ssz-text-primary)">{t('noRemarks')}</p>
      )}
      {feedback.items.map((item, i) => (
        <Remark key={i} item={item} />
      ))}
    </>
  );
}

function Remark({ item }: { item: FeedbackItem }) {
  const t = useTranslations('ExerciseRunner.precheck');
  return (
    <div
      className={`flex flex-col gap-0.5 border-l-[3px] pl-2.5 ${
        item.severity === 'major' ? 'border-(--ssz-text-accent)' : 'border-(--ssz-border-default)'
      }`}
    >
      <p className="text-[11.5px] font-semibold text-(--ssz-text-muted)">
        {t(`kind.${item.kind}`)}
      </p>
      {item.original !== null && (
        <p className="text-[14px] text-(--ssz-text-primary)">
          {item.suggestion !== null ? `${item.original}  →  ${item.suggestion}` : item.original}
        </p>
      )}
      <p className="text-[13.5px] leading-snug text-(--ssz-text-secondary)">{item.explanation}</p>
    </div>
  );
}
