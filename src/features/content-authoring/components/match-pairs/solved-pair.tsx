'use client';

import type { Variant } from '@/lib/shared-kernel/match-pairs';

const READING = 'var(--ssz-font-reading)';

export interface SolvedPairProps {
  left: string;
  right: string;
  variant: Variant;
  /** The half is the wrong one — shown as the sentence the student would have built. */
  wrong?: boolean;
  className?: string;
}

/**
 * A pair read as one line: the left half followed by the half attached to it.
 *
 * The two are marked differently on purpose. Correct, it is the sentence the exercise is
 * about; wrong, it is the sentence the student actually built, and seeing it whole is
 * what makes an explanation easy to write — the teacher is looking at the mistake, not
 * at two list entries they have to join in their head.
 */
export function SolvedPair({ left, right, variant, wrong = false, className }: SolvedPairProps) {
  const font = variant === 'halves' ? READING : undefined;
  const joiner = variant === 'halves' ? ' ' : ' — ';

  return (
    <p className={`text-sm ${className ?? ''}`} style={{ fontFamily: font }}>
      {left}
      {joiner}
      <mark
        className={
          wrong
            ? 'rounded-sm bg-error-50 px-1 text-error line-through decoration-1'
            : 'rounded-sm bg-success-50 px-1 text-success-700'
        }
      >
        {right}
      </mark>
    </p>
  );
}
