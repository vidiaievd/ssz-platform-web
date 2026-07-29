'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { GlossaryText } from './glossary-text';
import { parseMarkdownBlocks, type MarkdownBlock } from '../lib/parse-markdown-blocks';
import { type GlossaryIndex } from '../lib/tokenize-glossary';

const HEADING_CLASS: Record<number, string> = {
  1: 'text-[22px] font-semibold',
  2: 'text-[19px] font-semibold',
  3: 'text-[17px] font-semibold',
};

function Blocks({
  blocks,
  glossary,
  cefrLevel,
}: {
  blocks: MarkdownBlock[];
  glossary: GlossaryIndex;
  cefrLevel?: string;
}) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading': {
            const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2';
            return (
              <Tag
                key={i}
                className={cn(
                  'font-reading mt-1 mb-0 text-(--ssz-text-primary)',
                  HEADING_CLASS[block.level] ?? HEADING_CLASS[3],
                )}
              >
                <GlossaryText text={block.text} glossary={glossary} cefrLevel={cefrLevel} />
              </Tag>
            );
          }
          case 'list':
            return (
              <ul key={i} className="m-0 flex list-disc flex-col gap-1 pl-5.5">
                {block.items.map((item, j) => (
                  <li key={j} className="font-reading m-0 text-(--ssz-text-primary)">
                    <GlossaryText text={item} glossary={glossary} cefrLevel={cefrLevel} />
                  </li>
                ))}
              </ul>
            );
          case 'quote':
            return (
              <blockquote
                key={i}
                className={cn(
                  'm-0 flex flex-col gap-3 rounded-[14px] border-l-[3px] border-(--ssz-color-primary-400)',
                  'bg-(--ssz-bg-subtle) py-4 pr-4.5 pl-4',
                )}
              >
                <Blocks blocks={block.blocks} glossary={glossary} cefrLevel={cefrLevel} />
              </blockquote>
            );
          default:
            return (
              <p
                key={i}
                className="font-reading m-0 text-(--ssz-text-primary)"
                style={{ textWrap: 'pretty' } as React.CSSProperties}
              >
                <GlossaryText text={block.text} glossary={glossary} cefrLevel={cefrLevel} />
              </p>
            );
        }
      })}
    </>
  );
}

export interface LessonProseProps {
  /** One markdown chunk as split by content-service — may hold a quote, list or heading. */
  text: string;
  glossary: GlossaryIndex;
  /** BCP-47 language of `text`, for assistive tech / font selection. */
  lang?: string;
  /** Reader's CEFR level — selects translation vs. target-language definition (B2+). */
  cefrLevel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Renders a lesson body chunk with its markdown structure and glossary lookups. */
export function LessonProse({ text, glossary, lang, cefrLevel, className, style }: LessonProseProps) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);

  return (
    <div lang={lang} className={cn('flex flex-col gap-3.5', className)} style={style}>
      <Blocks blocks={blocks} glossary={glossary} cefrLevel={cefrLevel} />
    </div>
  );
}
