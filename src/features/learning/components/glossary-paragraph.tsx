'use client';

import { cn } from '@/lib/utils';

import { GlossaryText } from './glossary-text';
import { type GlossaryIndex } from '../lib/tokenize-glossary';

export interface GlossaryParagraphProps {
  text: string;
  glossary: GlossaryIndex;
  /** BCP-47 language of `text`, for assistive tech / font selection. */
  lang?: string;
  /** Reader's CEFR level — selects translation vs. target-language definition (B2+). */
  cefrLevel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders `text` as a single paragraph with glossary-marked words as tappable
 * lookup popovers. For lesson bodies, which carry block structure (quotes,
 * lists, headings), use `LessonProse` instead.
 */
export function GlossaryParagraph({ text, glossary, lang, cefrLevel, className, style }: GlossaryParagraphProps) {
  return (
    <p
      lang={lang}
      className={cn('font-reading m-0 text-(--ssz-text-primary)', className)}
      style={{ textWrap: 'pretty', ...style } as React.CSSProperties}
    >
      <GlossaryText text={text} glossary={glossary} cefrLevel={cefrLevel} />
    </p>
  );
}
