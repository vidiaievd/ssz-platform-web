'use client';

import { useMemo } from 'react';

import type { LessonTextSpan } from '@/features/content/types';
import { cn } from '@/lib/utils';

import { GlossaryText } from './glossary-text';
import { parseMarkdownBlocks, type MappedText, type MarkdownBlock } from '../lib/parse-markdown-blocks';
import { projectSpansOntoBlocks, type ProjectedSpan } from '../lib/project-span';
import { type GlossaryIndex } from '../lib/tokenize-glossary';

const HEADING_CLASS: Record<number, string> = {
  1: 'text-[22px] font-semibold',
  2: 'text-[19px] font-semibold',
  3: 'text-[17px] font-semibold',
};

/** Everything the annotation layer needs, kept together so `Blocks` can pass it on whole. */
interface AnnotationProps {
  /** Author spans of this paragraph, keyed by the block node that renders each. */
  placed: Map<MappedText, ProjectedSpan<LessonTextSpan>[]>;
  authoredVocabulary: boolean;
  spansHidden: boolean;
  explanationLanguage?: string;
}

function Blocks({
  blocks,
  glossary,
  cefrLevel,
  lang,
  annotations,
}: {
  blocks: MarkdownBlock[];
  glossary: GlossaryIndex;
  cefrLevel?: string;
  /** BCP-47 language of the prose — reaches the lookup card's pronunciation. */
  lang?: string;
  annotations: AnnotationProps;
}) {
  const { placed, authoredVocabulary, spansHidden, explanationLanguage } = annotations;

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
                <GlossaryText
                  lang={lang}
                  text={block.text}
                  glossary={glossary}
                  cefrLevel={cefrLevel}
                  spans={placed.get(block)}
                  authoredVocabulary={authoredVocabulary}
                  spansHidden={spansHidden}
                  explanationLanguage={explanationLanguage}
                />
              </Tag>
            );
          }
          case 'list':
            return (
              <ul key={i} className="m-0 flex list-disc flex-col gap-1 pl-5.5">
                {block.items.map((item, j) => (
                  <li key={j} className="font-reading m-0 text-(--ssz-text-primary)">
                    <GlossaryText
                      lang={lang}
                      text={item.text}
                      glossary={glossary}
                      cefrLevel={cefrLevel}
                      spans={placed.get(item)}
                      authoredVocabulary={authoredVocabulary}
                      spansHidden={spansHidden}
                      explanationLanguage={explanationLanguage}
                    />
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
                <Blocks
                  lang={lang}
                  blocks={block.blocks}
                  glossary={glossary}
                  cefrLevel={cefrLevel}
                  annotations={annotations}
                />
              </blockquote>
            );
          default:
            return (
              <p
                key={i}
                className="font-reading m-0 text-(--ssz-text-primary)"
                style={{ textWrap: 'pretty' } as React.CSSProperties}
              >
                <GlossaryText
                  lang={lang}
                  text={block.text}
                  glossary={glossary}
                  cefrLevel={cefrLevel}
                  spans={placed.get(block)}
                  authoredVocabulary={authoredVocabulary}
                  spansHidden={spansHidden}
                  explanationLanguage={explanationLanguage}
                />
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
  /**
   * Author annotations anchored to this paragraph, with `charStart`/`charEnd`
   * in the coordinates of `text` — the raw markdown, exactly as stored
   * (spec 16 §2.1). Projecting them onto the block structure happens here.
   */
  spans?: LessonTextSpan[];
  /** Spec 16 §5.3, decided per variant: authored spans replace the tokenizer entirely. */
  authoredVocabulary?: boolean;
  /** Gloss visibility is `off` — grammar and chunk backdrops are withheld. */
  spansHidden?: boolean;
  /** BCP-47 language of grammar explanations, loaded when an annotation opens. */
  explanationLanguage?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Renders a lesson body chunk with its markdown structure and glossary lookups. */
export function LessonProse({
  text,
  glossary,
  lang,
  cefrLevel,
  spans,
  authoredVocabulary = false,
  spansHidden = false,
  explanationLanguage,
  className,
  style,
}: LessonProseProps) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  const placed = useMemo(() => projectSpansOntoBlocks(blocks, spans ?? []), [blocks, spans]);

  return (
    <div lang={lang} className={cn('flex flex-col gap-3.5', className)} style={style}>
      <Blocks
        blocks={blocks}
        glossary={glossary}
        cefrLevel={cefrLevel}
        annotations={{ placed, authoredVocabulary, spansHidden, explanationLanguage }}
      />
    </div>
  );
}
