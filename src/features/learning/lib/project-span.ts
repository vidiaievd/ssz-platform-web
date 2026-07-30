import type { LessonSpanKind } from '@/features/content/types';

import { collectMappedTexts } from './parse-markdown-blocks';
import type { MappedText, MarkdownBlock } from './parse-markdown-blocks';

/** The half-open range into one paragraph's raw markdown that a span occupies (spec 16 §2.1). */
export interface SpanRange {
  charStart: number;
  charEnd: number;
}

/** A span placed on one run of text, in that run's own coordinates. */
export interface ProjectedSpan<T> {
  span: T;
  start: number;
  end: number;
}

/**
 * Finds the output range covering source range `[srcStart, srcEnd)`, given a
 * parser's `sourceIndexOf` map, or `null` when the range reaches no output
 * character at all.
 *
 * The result is always contiguous: the map is non-decreasing, so the output
 * indices pointing into any source interval form one run. `null` means either
 * that the range lies outside this run of text, or that it covers only
 * characters the parser dropped — a selection of exactly `**` annotates
 * nothing and cannot be rendered (spec 16 §2.3).
 *
 * Note the asymmetry with the maps' own trailing entry: this returns a range
 * over *output* indices, so `end` is a proper exclusive end.
 */
export function projectRange(
  sourceIndexOf: number[],
  srcStart: number,
  srcEnd: number,
): { start: number; end: number } | null {
  if (srcEnd <= srcStart) return null;

  // The map holds one entry per character plus the exclusive-end entry, which
  // belongs to no character and must not be projected onto.
  const length = sourceIndexOf.length - 1;
  let start = -1;
  let end = -1;

  for (let i = 0; i < length; i += 1) {
    const source = sourceIndexOf[i]!;
    if (source >= srcEnd) break;
    if (source < srcStart) continue;
    if (start === -1) start = i;
    end = i + 1;
  }

  return start === -1 ? null : { start, end };
}

/**
 * Places each span on the block that renders it, keyed by that block's
 * `MappedText` node so the renderer can look its spans up while walking the
 * block tree.
 *
 * A span that reaches into two blocks is **dropped**, not split. Its projected
 * range would not be contiguous in anything the reader sees — a chunk selected
 * across a list-item boundary would have to be drawn as two backdrops in two
 * `<li>`s, which reads as two annotations — so spec 16 §2.3 renders it as plain
 * text instead. The authoring UI already refuses to create one (`bodyRangeToSpan`
 * rejects a selection crossing a paragraph), but a body edited afterwards can
 * grow a list marker in the middle of an existing span, so the renderer must
 * survive it.
 *
 * Dropping here is **not** the brokenness of spec 16 §4: the span still matches
 * its snapshot and the author is not told about it. It is unrenderable at this
 * position, which is a different claim from being wrong.
 */
export function projectSpansOntoBlocks<T extends SpanRange>(
  blocks: MarkdownBlock[],
  spans: readonly T[],
): Map<MappedText, ProjectedSpan<T>[]> {
  const nodes = collectMappedTexts(blocks);
  const placed = new Map<MappedText, ProjectedSpan<T>[]>();

  for (const span of spans) {
    let owner: MappedText | undefined;
    let range: { start: number; end: number } | undefined;

    for (const node of nodes) {
      const hit = projectRange(node.sourceIndexOf, span.charStart, span.charEnd);
      if (!hit) continue;
      if (owner) {
        owner = undefined;
        break;
      }
      owner = node;
      range = hit;
    }

    if (!owner || !range) continue;
    const list = placed.get(owner);
    if (list) list.push({ span, ...range });
    else placed.set(owner, [{ span, ...range }]);
  }

  for (const list of placed.values()) {
    list.sort((a, b) => a.start - b.start || a.end - b.end);
  }
  return placed;
}

/**
 * Whether authored spans are the sole source of vocabulary highlighting for
 * this variant — the read-precedence rule of spec 16 §5.3.
 *
 * Decided per variant rather than per word. The tokenizer would otherwise add
 * every other occurrence of a word the author deliberately marked once, making
 * the deliberate act invisible and the result impossible to reason about. All
 * or nothing per text is a state the author can see and control.
 *
 * `grammar` and `chunk` spans do not count: they have no tokenizer counterpart
 * and nothing to collide with, so a text annotated only for grammar keeps its
 * tokenizer-driven lexis highlighting.
 *
 * Broken spans are excluded defensively. The reader's query asks for
 * `includeBroken=false` and the service filters them out, so this should never
 * matter — but a variant whose only vocab span is broken must fall back to the
 * tokenizer rather than lose its highlighting entirely.
 */
export function usesAuthoredVocabulary(
  spans: readonly { kind: LessonSpanKind; broken?: boolean }[],
): boolean {
  return spans.some((span) => span.kind === 'vocab' && !span.broken);
}
