import type { Gap } from '@/lib/shared-kernel/wordbank-gapfill';

/** The reading face the student sees, so the teacher reads the sentence in it too. */
const READING = 'var(--ssz-font-reading)';

interface SentenceWithAnswerProps {
  gap: Gap;
  className?: string;
}

/**
 * One gap's sentence with its answer picked out.
 *
 * Shared by both views of step 3 because both ask the same thing of the teacher — write
 * about *this* gap — and a matrix row or a cell editor without the sentence is a label
 * and a word with nothing to explain.
 */
export function SentenceWithAnswer({ gap, className = '' }: SentenceWithAnswerProps) {
  const words = gap.sentence.trim().split(/\s+/);

  return (
    <span className={`text-xs text-muted-foreground ${className}`} style={{ fontFamily: READING }}>
      {words.map((word, index) => (
        <span key={index} className={index === gap.tokenIndex ? 'font-semibold text-primary' : ''}>
          {word}{' '}
        </span>
      ))}
    </span>
  );
}
