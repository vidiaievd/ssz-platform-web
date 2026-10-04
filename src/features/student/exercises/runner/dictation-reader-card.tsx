'use client';

import { ArrowRight, Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatDuration } from '@/lib/shared-kernel/audio';

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface DictationReaderCardProps {
  /** The exercise's title, from the lesson it sits in — the projection carries none. */
  title?: string;
  /** Sentences the student will write. */
  sentences: number;
  /** Clip length in seconds; `0` leaves it out. */
  duration: number;
  /** Listens allowed; `0` is unlimited. */
  plays: number;
  instruction: string;
  onStart: () => void;
  /** False in the builder's preview: the card is drawn, the button does nothing. */
  interactive?: boolean;
  accent: string;
}

/**
 * How a dictation appears in the lesson before it is opened — BEHAVIOR §7, plan 68 Q6-A.
 *
 * The title, how many sentences, how long the clip is, how many listens, and the instruction.
 * Never the text: nothing here could hold it, because the card is drawn from the student
 * projection and the clip's own metadata. Starting is a press, so the attempt opens and the
 * player loads only then — a card glanced at spends nothing.
 */
export function DictationReaderCard({
  title,
  sentences,
  duration,
  plays,
  instruction,
  onStart,
  interactive = true,
  accent,
}: DictationReaderCardProps) {
  const t = useTranslations('ExerciseRunner.dictation.card');

  const facts = [
    t('sentences', { n: sentences }),
    ...(duration > 0 ? [formatDuration(duration)] : []),
    plays > 0 ? t('plays', { n: plays }) : t('freePlay'),
  ].join(' · ');

  return (
    <section
      aria-label={title === undefined || title.trim() === '' ? t('defaultTitle') : title}
      className="flex w-full flex-col gap-(--ssz-space-3) rounded-(--ssz-radius-lg) border p-(--ssz-space-5)"
      style={{
        maxWidth: 560,
        background: 'var(--ssz-bg-surface)',
        borderColor: 'var(--ssz-border-default)',
        boxShadow: 'var(--ssz-shadow-sm)',
      }}
    >
      <div className="flex items-center gap-(--ssz-space-3)">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-(--ssz-radius-md)"
          style={{
            background: 'var(--ssz-feedback-key-bg)',
            color: 'var(--ssz-feedback-key-fg)',
          }}
        >
          <Headphones size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-base font-semibold text-(--ssz-text-primary)">
            {title === undefined || title.trim() === '' ? t('defaultTitle') : title}
          </strong>
          <p
            className="m-0 mt-0.5 text-xs text-(--ssz-text-muted)"
            style={{ fontFamily: 'var(--ssz-font-mono)' }}
          >
            {facts}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: 'var(--ssz-bg-subtle)', color: 'var(--ssz-text-secondary)' }}
        >
          {t('badge')}
        </span>
      </div>
      {instruction.trim() !== '' && (
        <p
          className="m-0 text-base text-(--ssz-text-secondary)"
          style={{ fontFamily: 'var(--ssz-font-reading)' }}
        >
          {instruction}
        </p>
      )}
      <button
        type="button"
        onClick={onStart}
        disabled={!interactive}
        className={`inline-flex items-center gap-2 self-start rounded-(--ssz-radius-sm) px-4 py-2.5 text-sm font-semibold text-white disabled:pointer-events-none ${FOCUS}`}
        style={{ background: accent, minHeight: 44 }}
      >
        {t('start')}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
