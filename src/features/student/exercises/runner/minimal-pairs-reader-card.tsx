'use client';

import { Ear, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { estimatedMinutes, type StudentProjection } from '@/lib/shared-kernel/minimal-pairs';

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface MinimalPairsReaderCardProps {
  projection: StudentProjection;
  /** The exercise's title from the lesson item, where the projection's own is empty. */
  title?: string;
  /** The instruction in the learner's language, where the reader has one. */
  instruction?: string;
  onStart: () => void;
  /** False in the builder's preview: the card is drawn, the button does nothing. */
  interactive?: boolean;
  /** A line under the button — a start that failed or was refused, and why. */
  notice?: string | null;
  /** The start is refused for good — the sittings are used, or there is nothing to play. */
  blocked?: boolean;
  starting?: boolean;
  accent: string;
}

/**
 * How a `minimal_pairs` set appears in the lesson before it is opened — the prototype's
 * `MPReaderCard` (plan 72 §7.10), in the frame of the dictation card.
 *
 * The contrast, how many probes, about how long, how the listening works. Drawn from the student
 * projection, so it holds no word and no clip. Starting is a press, and that matters twice here:
 * the attempt and its draw are made only then, and the press is the gesture the browser wants
 * before the first probe may play by itself (plan 72 §8, point 4).
 */
export function MinimalPairsReaderCard({
  projection,
  title,
  instruction,
  onStart,
  interactive = true,
  notice = null,
  blocked = false,
  starting = false,
  accent,
}: MinimalPairsReaderCardProps) {
  const t = useTranslations('ExerciseRunner.minimalPairs');
  const probes = projection.set.probes;
  const plays = projection.set.playsPerProbe;

  const heading =
    projection.title.trim() !== ''
      ? projection.title
      : title !== undefined && title.trim() !== ''
        ? title
        : t('defaultTitle');
  const shown =
    instruction !== undefined && instruction.trim() !== ''
      ? instruction
      : projection.instruction.trim() !== ''
        ? projection.instruction
        : t('card.defaultInstruction');

  const facts = [
    ...(projection.contrast.label === '' ? [] : [projection.contrast.label]),
    t('card.probes', { n: probes }),
    t('card.minutes', { min: estimatedMinutes(probes) }),
  ].join(' · ');
  const how = [
    plays > 0 ? t('card.plays', { n: plays }) : t('card.freePlay'),
    t('card.answerAtOnce'),
    ...(projection.feedback.abCompare ? [t('card.hearDifference')] : []),
  ].join(' · ');

  return (
    <section
      aria-label={heading}
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
            background: 'var(--ssz-color-primary-50)',
            color: 'var(--ssz-color-primary-700)',
          }}
        >
          <Ear size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-base font-semibold text-(--ssz-text-primary)">
            {heading}
          </strong>
          <p
            className="m-0 mt-0.5 text-xs text-(--ssz-text-muted)"
            style={{ fontFamily: 'var(--ssz-font-mono)' }}
          >
            {facts}
          </p>
        </div>
      </div>
      <p
        className="m-0 text-base text-(--ssz-text-secondary)"
        style={{ fontFamily: 'var(--ssz-font-reading)' }}
      >
        {shown}
      </p>
      <p className="m-0 text-xs text-(--ssz-text-muted)">{how}</p>
      <button
        type="button"
        onClick={onStart}
        disabled={!interactive || starting || blocked}
        className={`inline-flex items-center gap-2 self-start rounded-(--ssz-radius-sm) px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45 ${FOCUS}`}
        style={{ background: accent, minHeight: 44 }}
      >
        <Play size={14} aria-hidden="true" />
        {t('card.start')}
      </button>
      {notice !== null && (
        <p role="status" className="m-0 text-xs text-(--ssz-text-muted)">
          {notice}
        </p>
      )}
    </section>
  );
}
