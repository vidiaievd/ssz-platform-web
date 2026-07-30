/**
 * A run of block text together with where each of its characters came from in
 * the chunk that was parsed.
 *
 * `sourceIndexOf[i]` is the index in the parser's input of output character
 * `i`; the length is `text.length + 1`, the extra trailing entry being the
 * exclusive end. See `InlineMarkdown.sourceIndexOf` — the two maps compose, and
 * together they project a `LessonTextSpan`'s raw-markdown offsets (spec 16
 * §2.1) onto the string the reader actually displays.
 *
 * As with `InlineMarkdown.sourceIndexOf`, `sourceIndexOf[b]` is the position of
 * the character after output range `[a, b)`, not that range's exclusive end:
 * the input range it covers ends at `sourceIndexOf[b - 1] + 1`. Markup the
 * parser dropped — a bullet marker, a `> ` prefix — sits between the two.
 *
 * The map is non-decreasing and every non-whitespace output character equals
 * the input character it maps to. Whitespace is weaker: this parser joins
 * soft-wrapped lines with a space and quote lines with a newline, and those
 * joiners map to whatever whitespace stood between the lines in the source —
 * a newline, trailing spaces, or a `>` continuation. Span endpoints always sit
 * on non-whitespace (content-service refuses a whitespace-only snapshot, spec
 * 16 §6.2), so the weaker guarantee costs projection nothing.
 */
export interface MappedText {
  text: string;
  sourceIndexOf: number[];
}

export type MarkdownBlock =
  | ({ kind: 'heading'; level: number } & MappedText)
  | ({ kind: 'paragraph' } & MappedText)
  | { kind: 'list'; items: MappedText[] }
  | { kind: 'quote'; blocks: MarkdownBlock[] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*+]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

/** A contiguous slice of the chunk, and where it starts in it. */
interface SourcePiece {
  text: string;
  start: number;
}

/** `source.slice(start, end)` trimmed, with `start` moved onto the first kept character. */
function trimmedPiece(source: string, start: number, end: number): SourcePiece {
  const raw = source.slice(start, end);
  return { text: raw.trim(), start: start + (raw.length - raw.trimStart().length) };
}

/**
 * Concatenates contiguous slices of the source, inserting `separator` between
 * them, and tracks where every resulting character came from.
 *
 * A separator character has no source character of its own, so it maps to the
 * gap it replaces — the index just past the preceding piece, which is where the
 * dropped whitespace begins.
 */
function joinPieces(pieces: SourcePiece[], separator: string): MappedText {
  let text = '';
  const sourceIndexOf: number[] = [];
  let gap = 0;

  pieces.forEach((piece, i) => {
    if (i > 0) {
      for (let k = 0; k < separator.length; k += 1) sourceIndexOf.push(gap);
      text += separator;
    }
    for (let k = 0; k < piece.text.length; k += 1) sourceIndexOf.push(piece.start + k);
    text += piece.text;
    gap = piece.start + piece.text.length;
  });

  sourceIndexOf.push(gap);
  return { text, sourceIndexOf };
}

/** Reads `inner`'s indices through `outer`, turning a two-hop map into one. */
export function composeSourceMaps(outer: number[], inner: number[]): number[] {
  return inner.map((index) => outer[index]!);
}

/**
 * Rebases blocks parsed from a synthesised string onto the chunk it was built
 * from. Needed for blockquotes: their content is re-joined without the `>`
 * prefixes before being parsed again, so the inner blocks' maps index that
 * intermediate string rather than the chunk the caller holds.
 */
function remapBlocks(blocks: MarkdownBlock[], outer: number[]): MarkdownBlock[] {
  return blocks.map((block) => {
    switch (block.kind) {
      case 'list':
        return {
          ...block,
          items: block.items.map((item) => ({
            ...item,
            sourceIndexOf: composeSourceMaps(outer, item.sourceIndexOf),
          })),
        };
      case 'quote':
        return { ...block, blocks: remapBlocks(block.blocks, outer) };
      default:
        return { ...block, sourceIndexOf: composeSourceMaps(outer, block.sourceIndexOf) };
    }
  });
}

/**
 * Parses one chunk of lesson markdown into block structure. `text` fields keep
 * their inline markup — `parseInlineMarkdown` handles that layer.
 *
 * Lesson bodies arrive already split on blank lines by content-service
 * (`MarkdownParagraphSplitterService`), and paragraph index is the key for
 * translations, so this parser never re-splits across chunks: it describes the
 * structure *inside* one chunk. A blockquote is one chunk even when it spans
 * many lines, because its blank lines carry a `>`.
 *
 * Soft-wrapped lines are joined with a space, matching how the browser collapses
 * newlines when the same text is rendered as plain text today.
 *
 * Ordered lists are deliberately not recognized. Norwegian lesson bodies contain
 * lines like «17. mai er Norges nasjonaldag» and «1. april.» — dates and
 * ordinals, not list items — and no seeded lesson uses an ordered list.
 *
 * Every block carries a `sourceIndexOf` map back into `chunk`; see `MappedText`.
 */
export function parseMarkdownBlocks(chunk: string): MarkdownBlock[] {
  const lines = chunk.split('\n');
  // Offsets of each line in `chunk`, so a match inside a line can be placed.
  const lineStart: number[] = [];
  let at = 0;
  for (const line of lines) {
    lineStart.push(at);
    at += line.length + 1;
  }

  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const lineEnd = lineStart[i]! + line.length;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const trimmedLine = trimmedPiece(chunk, lineStart[i]!, lineEnd);
    const heading = HEADING.exec(trimmedLine.text);
    if (heading) {
      // `(.*)$` runs to the end of the trimmed line, so its capture starts that
      // many characters from the end.
      const textStart = trimmedLine.start + (trimmedLine.text.length - heading[2]!.length);
      const piece = trimmedPiece(chunk, textStart, textStart + heading[2]!.length);
      blocks.push({ kind: 'heading', level: heading[1]!.length, ...joinPieces([piece], '') });
      i += 1;
      continue;
    }

    if (QUOTE.test(line.trimStart())) {
      const quoted: SourcePiece[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!.trimStart())) {
        const current = lines[i]!;
        const leading = current.length - current.trimStart().length;
        const match = QUOTE.exec(current.trimStart())!;
        quoted.push({
          text: match[1]!,
          start: lineStart[i]! + leading + (match[0]!.length - match[1]!.length),
        });
        i += 1;
      }
      const joined = joinPieces(quoted, '\n');
      blocks.push({
        kind: 'quote',
        blocks: remapBlocks(parseMarkdownBlocks(joined.text), joined.sourceIndexOf),
      });
      continue;
    }

    if (BULLET.test(trimmedLine.text)) {
      const items: MappedText[] = [];
      while (i < lines.length) {
        const current = trimmedPiece(chunk, lineStart[i]!, lineStart[i]! + lines[i]!.length);
        const match = BULLET.exec(current.text);
        if (!match) break;
        const itemStart = current.start + (current.text.length - match[1]!.length);
        items.push(joinPieces([trimmedPiece(chunk, itemStart, itemStart + match[1]!.length)], ''));
        i += 1;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }

    const paragraph: SourcePiece[] = [];
    while (i < lines.length) {
      const current = lines[i]!;
      if (!current.trim()) break;
      const trimmed = current.trim();
      if (HEADING.test(trimmed) || BULLET.test(trimmed) || QUOTE.test(current.trimStart())) break;
      paragraph.push(trimmedPiece(chunk, lineStart[i]!, lineStart[i]! + current.length));
      i += 1;
    }
    blocks.push({ kind: 'paragraph', ...joinPieces(paragraph, ' ') });
  }

  return blocks;
}
