'use client';

import { Fragment } from 'react';

const GRAMMAR_HUE = '--ssz-type-grammar';

/** Escapes regex special characters so highlight words match literally. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface HighlightedSentenceProps {
  sentence: string;
  /** Substrings to tint — the forms the rule is about, as the author listed them. */
  highlights: string[];
  /** Tint strength of the mark's background, in percent. */
  intensity?: number;
}

/**
 * An example sentence with the rule's own forms picked out.
 *
 * Shared by the grammar lesson page and the reader's annotation card so the
 * same sentence is marked the same way in both — the card is a smaller window
 * onto the rule, not a different reading of it.
 */
export function HighlightedSentence({
  sentence,
  highlights,
  intensity = 25,
}: HighlightedSentenceProps) {
  const words = highlights.filter(Boolean);
  if (words.length === 0) return <>{sentence}</>;

  const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'g');

  return (
    <>
      {sentence.split(pattern).map((part, i) =>
        words.includes(part) ? (
          <span
            key={i}
            className="rounded font-bold"
            style={{
              background: `color-mix(in oklch, var(${GRAMMAR_HUE}) ${intensity}%, transparent)`,
              color: `var(${GRAMMAR_HUE})`,
              padding: '1px 5px',
            }}
          >
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
