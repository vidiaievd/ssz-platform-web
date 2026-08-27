'use client';

import { useTranslations } from 'next-intl';

import type { ProjectedItem } from '@/lib/shared-kernel/sentence-schema';

export interface WordBankProps {
  /** The pieces of this sentence, already shuffled by the server. */
  items: ProjectedItem[];
  /** Ids currently on the board — drawn in place, faded, and not selectable. */
  used: string[];
  /** The piece waiting for a field, in the tap-a-word-then-tap-a-field path. */
  selected: string | null;
  onPress?: (itemId: string) => void;
  /** False in a preview, and while the sentence is locked. */
  interactive: boolean;
  /** Show the header with the count of what is left. */
  showHead?: boolean;
  accent: string;
}

const TAP_MIN = 44;
const READING = 'var(--ssz-font-reading)';

/**
 * The bank of pieces, and one rule that is easy to get wrong: **a used piece stays where
 * it was**, at reduced opacity, rather than leaving the bank.
 *
 * Removing it reflows everything after it, which destroys the spatial memory the learner
 * has been building for the last four placements — and mid-sentence, that is the thing
 * they were relying on. `match_pairs` settled this the same way. The count of what is left
 * carries the "how much is there still to do" signal instead.
 *
 * The pieces are already in the order the server shuffled them into. Nothing here
 * reorders anything: a bank in sentence order is the answer in order, and a client that
 * arranged it would be arranging something the network tab had already shown.
 */
export function WordBank({
  items,
  used,
  selected,
  onPress,
  interactive,
  showHead = true,
  accent,
}: WordBankProps) {
  const t = useTranslations('ExerciseRunner');
  const left = items.length - used.length;

  return (
    // `.ss-bank[data-inline="true"]`: a dashed rule above it and nothing else — the bank
    // is separated from the board rather than boxed off from it.
    <div
      className="flex flex-col gap-[9px] border-t border-dashed pt-3"
      style={{ borderColor: 'var(--ssz-border-default)' }}
    >
      {showHead && (
        <div className="flex items-baseline justify-between">
          <strong
            className="text-[11px] font-bold tracking-[0.12em] uppercase"
            style={{ color: 'var(--ssz-text-muted)' }}
          >
            {t('sentenceSchema.bankLabel')}
          </strong>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('sentenceSchema.remaining', { count: left })}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isUsed = used.includes(item.id);
          const armed = selected === item.id;
          return (
            <button
              key={item.id}
              type="button"
              draggable={interactive && !isUsed}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', item.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onPress?.(item.id)}
              // Exposed, not implied: opacity says nothing to a screen reader, and these
              // pieces are the exercise.
              aria-disabled={!interactive}
              aria-pressed={armed}
              // `.ss-word`: a fully rounded pill on a raised surface. Selected, it fills
              // with the accent rather than tinting — one piece is armed at a time, and
              // it has to be unmistakable at a glance across a bank of seven.
              className="rounded-full border px-3 py-[7px] text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{
                minHeight: TAP_MIN,
                fontFamily: READING,
                background: armed ? accent : 'var(--ssz-bg-surface)',
                borderColor: armed ? accent : 'var(--ssz-border-strong)',
                color: armed ? 'var(--ssz-text-inverse)' : 'var(--ssz-text-primary)',
                boxShadow: isUsed ? 'none' : 'var(--ssz-shadow-xs)',
                opacity: isUsed ? 0.3 : 1,
                cursor: interactive ? 'pointer' : 'default',
              }}
            >
              {item.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
