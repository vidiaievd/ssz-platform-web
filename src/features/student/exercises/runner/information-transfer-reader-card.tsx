'use client';

import { Headphones, Play, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { StudentProjection } from '@/lib/shared-kernel/information-transfer';

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)';

export interface InformationTransferReaderCardProps {
  projection: StudentProjection;
  /**
   * The exercise's title as the lesson names it. Optional: a blank opened straight from its own
   * page has no lesson around it, and then the title the author gave the exercise (the
   * projection's) stands in.
   */
  title?: string;
  /** Listens allowed on a recording; `0` is unlimited. Read off the audio block, not the blank. */
  plays?: number;
  /** A recording with a fragment per cell. */
  fragments?: boolean;
  onStart: () => void;
  /** False in the builder's preview: the card is drawn, the button does nothing. */
  interactive?: boolean;
  accent: string;
}

/**
 * How an information-transfer blank appears in the lesson before it is opened — plan 73 §7.10.
 *
 * The source's icon, the title, the skill and the size of the task, the instruction, and how
 * the delivery is set. The pass mark is not here (deviation 14): the card is drawn from the
 * student projection and nothing in it knows the key or the threshold. Starting is a press, so
 * the attempt opens and the player loads only then.
 */
export function InformationTransferReaderCard({
  projection,
  title,
  plays = 0,
  fragments = false,
  onStart,
  interactive = true,
  accent,
}: InformationTransferReaderCardProps) {
  const t = useTranslations('ExerciseRunner.informationTransfer');
  const named = [title, projection.title].find((n) => n !== undefined && n.trim() !== '');
  const heading = named ?? t('defaultTitle');

  const audio = projection.sourceKind === 'audio';
  const cells = projection.fields.length;
  const minutes = Math.max(2, Math.round(cells * 0.8));
  const Icon = audio ? Headphones : Type;

  const facts = [
    audio ? t('card.listening') : t('card.reading'),
    t('card.cells', { n: cells }),
    t('card.minutes', { n: minutes }),
  ].join(' · ');

  const delivery = [
    audio
      ? plays > 0
        ? t('card.plays', { n: plays })
        : t('card.freePlay')
      : t('card.textVisible'),
    ...(audio && fragments ? [t('card.fragments')] : []),
    projection.answering.attempts > 0
      ? t('card.attempts', { n: projection.answering.attempts })
      : t('card.unlimitedAttempts'),
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
          className="grid size-10 shrink-0 place-items-center rounded-full"
          style={{
            background: 'var(--ssz-feedback-key-bg)',
            color: 'var(--ssz-feedback-key-fg)',
          }}
        >
          <Icon size={20} />
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
        lang={projection.language || undefined}
      >
        {projection.instruction.trim() !== ''
          ? projection.instruction
          : t('defaultInstructionCard')}
      </p>
      <p className="m-0 text-xs text-(--ssz-text-muted)">{delivery}</p>
      <button
        type="button"
        onClick={onStart}
        disabled={!interactive}
        className={`inline-flex items-center gap-2 self-start rounded-(--ssz-radius-sm) px-4 py-2.5 text-sm font-semibold text-white disabled:pointer-events-none ${FOCUS}`}
        style={{ background: accent, minHeight: 44 }}
      >
        {t('card.start')}
        <Play size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
