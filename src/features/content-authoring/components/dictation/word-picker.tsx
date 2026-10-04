'use client';

import { useTranslations } from 'next-intl';

import { tokens, type Segment } from '@/lib/shared-kernel/dictation';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

export interface WordPickerProps {
  segment: Segment;
  /** Label of the group — «Segment 2: the words». */
  label: string;
  onToggle: (wordIndex: number) => void;
}

/**
 * The sentence as buttons, one per word (plan 68 §7.2) — a click marks the word as the point
 * of the dictation, another unmarks it. A marked word with no reason yet has a dashed amber
 * border (AC-B6): the shape says it, not only the colour. Punctuation is drawn apart and is
 * never clickable — a focus word is a word.
 */
export function WordPicker({ segment, label, onToggle }: WordPickerProps) {
  const t = useTranslations('Authoring.dictation.step3');
  const words = tokens(segment.text);

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-baseline gap-y-1.5"
      style={{ ...READING, fontSize: 'var(--ssz-text-lg)', lineHeight: 2.1 }}
    >
      {words.map((word) => {
        const focus = segment.focus.find((f) => f.wordIndex === word.i);
        const silent = focus !== undefined && focus.why.trim() === '';
        const title =
          focus === undefined ? t('picker.mark') : silent ? t('picker.noReason') : focus.why.trim();
        return (
          <span key={word.i} className="inline-flex items-baseline">
            <button
              type="button"
              aria-pressed={focus !== undefined}
              data-silent={silent ? 'true' : undefined}
              title={title}
              onClick={() => onToggle(word.i)}
              className={[
                'rounded-md border px-1 py-0.5 hover:bg-(--ssz-bg-muted)',
                'focus-visible:shadow-(--ssz-focus-ring) focus-visible:outline-none',
                focus === undefined
                  ? 'border-transparent'
                  : 'border-(--ssz-color-primary-200) bg-(--ssz-color-primary-100) font-semibold text-(--ssz-color-primary-800) hover:bg-(--ssz-color-primary-100)',
                silent ? 'border-dashed border-(--ssz-color-warning-500)' : '',
              ].join(' ')}
            >
              {word.w}
            </button>
            {word.p !== '' && (
              <span aria-hidden="true" className="mr-1 text-(--ssz-text-muted)">
                {word.p}
              </span>
            )}
            {word.p === '' && <span aria-hidden="true">&nbsp;</span>}
          </span>
        );
      })}
    </div>
  );
}
