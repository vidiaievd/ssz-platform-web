'use client';

import { Headphones } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { StudentProjection } from '@/lib/shared-kernel/read-aloud';

import { RA_FOCUS } from './read-aloud-parts';

export interface ReadAloudReaderCardProps {
  projection: StudentProjection;
  /** The exercise's title, from the lesson item; the projection's own otherwise. */
  title?: string;
  /** Replaces the author's instruction line, which the reader translates per learner. */
  instruction?: string;
  onStart: () => void;
  /** False in the builder's preview: the card is drawn, the button does nothing. */
  interactive?: boolean;
  accent: string;
}

/**
 * How a speaking task appears in the lesson before it is opened — the prototype's `ReaderCard`
 * (plan 70 §7.10, deviation 24), in the look of the dictation card it shares (`dc-reader`).
 *
 * The mode, how many recordings, that a teacher grades it, the instruction, and the recording
 * rules in one line. Starting is a press: the attempt opens and the microphone is asked for
 * only then — a card glanced at costs nothing and asks for nothing.
 */
export function ReadAloudReaderCard({
  projection,
  title,
  instruction,
  onStart,
  interactive = true,
  accent,
}: ReadAloudReaderCardProps) {
  const t = useTranslations('ExerciseRunner.readAloud');
  const heading = title?.trim() || projection.title.trim() || t('card.defaultTitle');
  const shown = instruction?.trim() || projection.instruction.trim() || t('defaultInstruction');
  const { takes, listenBack } = projection.recording;

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
          className="grid size-10 shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--ssz-color-primary-50)',
            color: 'var(--ssz-color-primary-700)',
          }}
        >
          <Headphones size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-base font-semibold text-(--ssz-text-primary)">
            {heading}
          </strong>
          <p className="m-0 mt-0.5 text-xs text-(--ssz-text-muted)">
            {t('card.facts', {
              mode:
                projection.mode === 'read'
                  ? t('card.mode.read')
                  : projection.mode === 'monologue'
                    ? t('card.mode.monologue')
                    : t('card.mode.dialogue'),
              n: projection.prompts.length,
            })}
          </p>
        </div>
      </div>
      <p
        lang={projection.language || undefined}
        className="m-0 text-base text-(--ssz-text-secondary)"
        style={{ fontFamily: 'var(--ssz-font-reading)' }}
      >
        {shown}
      </p>
      <p className="m-0 text-xs text-(--ssz-text-muted)">
        {listenBack ? t('card.rulesListen', { n: takes }) : t('card.rules', { n: takes })}
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={!interactive}
        className={`inline-flex items-center gap-2 self-start rounded-(--ssz-radius-sm) px-4 py-2.5 text-sm font-semibold text-white disabled:pointer-events-none ${RA_FOCUS}`}
        style={{ background: accent, minHeight: 44 }}
      >
        <Headphones size={14} aria-hidden="true" />
        {t('card.start')}
      </button>
    </section>
  );
}
