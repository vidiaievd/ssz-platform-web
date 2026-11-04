'use client';

import { useMemo } from 'react';

import type { LessonTextSpan } from '@/features/content/types';
import { useMediaAsset } from '@/features/media';
import { cn } from '@/lib/utils';

import { GlossaryText } from './glossary-text';
import {
  parseMarkdownBlocks,
  type MappedText,
  type MarkdownBlock,
} from '../lib/parse-markdown-blocks';
import { projectSpansOntoBlocks, type ProjectedSpan } from '../lib/project-span';
import { type GlossaryIndex } from '../lib/tokenize-glossary';
import { MARKS_LEADING, marksByStart } from '@/features/student/prosody';
import type { ProsodyView, TokenMarks } from '@/features/student/prosody';
import type { ProsodyLayer, WordSounds } from '@/lib/shared-kernel/prosody';

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
  /** What of the pronunciation layer to draw, and each text run's marks (plan 86). */
  prosody?: { view: ProsodyView; runs: Map<MappedText, Map<number, TokenMarks>> };
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
  /** The marks of one text run, in the offsets of that run's own text. */
  const prosodyOf = (run: MappedText) => {
    const marks = annotations.prosody?.runs.get(run);
    return annotations.prosody && marks
      ? { prosody: { view: annotations.prosody.view, marks } }
      : {};
  };

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
                  {...prosodyOf(block)}
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
                      {...prosodyOf(item)}
                    />
                  </li>
                ))}
              </ul>
            );
          case 'table':
            return (
              // Its own scroll container: a paradigm table is wider than the
              // reading column on purpose, and a page that scrolls sideways as
              // a whole is far worse than one table that does.
              <div key={i} className="-mx-1 overflow-x-auto px-1">
                <table className="w-full border-collapse text-left text-[15px]">
                  {block.head.length > 0 && (
                    <thead>
                      <tr>
                        {block.head.map((cell, j) => (
                          <th
                            key={j}
                            scope="col"
                            className="border-b border-(--ssz-border-default) px-2.5 py-1.5 font-semibold text-(--ssz-text-primary)"
                          >
                            <GlossaryText
                              lang={lang}
                              text={cell.text}
                              glossary={glossary}
                              cefrLevel={cefrLevel}
                              spans={placed.get(cell)}
                              authoredVocabulary={authoredVocabulary}
                              spansHidden={spansHidden}
                              explanationLanguage={explanationLanguage}
                              {...prosodyOf(cell)}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td
                            key={k}
                            className="border-b border-(--ssz-border-default) px-2.5 py-1.5 align-top text-(--ssz-text-secondary)"
                          >
                            <GlossaryText
                              lang={lang}
                              text={cell.text}
                              glossary={glossary}
                              cefrLevel={cefrLevel}
                              spans={placed.get(cell)}
                              authoredVocabulary={authoredVocabulary}
                              spansHidden={spansHidden}
                              explanationLanguage={explanationLanguage}
                              {...prosodyOf(cell)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
          case 'image':
            return <LessonImage key={i} mediaId={block.mediaId} alt={block.alt} />;
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
                  {...prosodyOf(block)}
                />
              </p>
            );
        }
      })}
    </>
  );
}

/** Every text run of the blocks, in reading order — what a mark can land on. */
function runsOf(blocks: MarkdownBlock[]): MappedText[] {
  return blocks.flatMap((block): MappedText[] => {
    switch (block.kind) {
      case 'heading':
      case 'paragraph':
        return [block];
      case 'list':
        return block.items;
      case 'table':
        return [...block.head, ...block.rows.flat()];
      case 'quote':
        return runsOf(block.blocks);
      default:
        return [];
    }
  });
}

/**
 * The layer's marks re-keyed per text run. Marks are keyed by the word's start in the chunk's
 * raw markdown; a run knows where each of its characters came from (`sourceIndexOf`), so the
 * mark lands on the displayed word however much markup (`## `, `- `, `> `) was dropped before it.
 */
function marksOfRuns(
  blocks: MarkdownBlock[],
  byChunkStart: Map<number, TokenMarks>,
): Map<MappedText, Map<number, TokenMarks>> {
  const out = new Map<MappedText, Map<number, TokenMarks>>();
  if (byChunkStart.size === 0) return out;
  for (const run of runsOf(blocks)) {
    const marks = new Map<number, TokenMarks>();
    for (let k = 0; k < run.text.length; k += 1) {
      const found = byChunkStart.get(run.sourceIndexOf[k]!);
      if (found) marks.set(k, found);
    }
    if (marks.size > 0) out.set(run, marks);
  }
  return out;
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
  /**
   * Index of the paragraph this chunk is, when its words may be added to «My words»
   * (plan 75). Set on the target-language text only — never on a translation.
   */
  captureParagraph?: number;
  /**
   * The pronunciation layer of this chunk and what to draw of it (plan 86). `layer` is anchored
   * to `text` as stored; the caller checks it was made for exactly this text.
   */
  prosody?: { layer: ProsodyLayer; sounds?: readonly WordSounds[]; view: ProsodyView };
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
  captureParagraph,
  prosody,
  className,
  style,
}: LessonProseProps) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  const placed = useMemo(() => projectSpansOntoBlocks(blocks, spans ?? []), [blocks, spans]);
  const prosodyRuns = useMemo(
    () => (prosody ? marksOfRuns(blocks, marksByStart(text, prosody.layer, prosody.sounds)) : null),
    [blocks, text, prosody],
  );
  const drawn = prosody !== undefined && prosody.view.lens !== null && prosodyRuns !== null && prosodyRuns.size > 0;

  return (
    <div
      lang={lang}
      className={cn('flex flex-col gap-3.5', className)}
      style={drawn ? { ...style, lineHeight: MARKS_LEADING } : style}
      // Kept in step with CAPTURE_PARAGRAPH_ATTR, which the word context menu looks for.
      data-capture-paragraph={captureParagraph}
    >
      <Blocks
        blocks={blocks}
        glossary={glossary}
        cefrLevel={cefrLevel}
        annotations={{
          placed,
          authoredVocabulary,
          spansHidden,
          explanationLanguage,
          ...(drawn ? { prosody: { view: prosody.view, runs: prosodyRuns } } : {}),
        }}
      />
    </div>
  );
}

/** An image placed in the text, fetched by its media id; its caption is the alt text. */
function LessonImage({ mediaId, alt }: { mediaId: string; alt: string }) {
  const { data: asset } = useMediaAsset(mediaId);
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      {asset?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed media URL, not a static asset
        <img src={asset.url} alt={alt} className="w-full rounded-xl object-contain" />
      ) : (
        <div className="aspect-video w-full rounded-xl bg-(--ssz-bg-subtle)" />
      )}
      {alt !== '' && (
        <figcaption className="text-center text-[13px] text-(--ssz-text-muted)">{alt}</figcaption>
      )}
    </figure>
  );
}
