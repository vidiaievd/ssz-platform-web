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
    <div className="flex flex-col gap-1.5">
      {showHead && (
        <div className="flex items-baseline justify-between">
          <strong className="text-[12.5px]" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('sentenceSchema.bankLabel')}
          </strong>
          <span className="text-[12px]" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('sentenceSchema.remaining', { count: left })}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
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
              className="rounded-lg border px-3 py-2 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
              style={{
                minHeight: TAP_MIN,
                fontFamily: READING,
                background: armed ? 'var(--ssz-runner-practice-soft)' : 'var(--ssz-bg-surface)',
                borderColor: armed ? accent : 'var(--ssz-border-default)',
                color: 'var(--ssz-text-primary)',
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
