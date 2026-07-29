export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'quote'; blocks: MarkdownBlock[] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*+]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

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
 */
export function parseMarkdownBlocks(chunk: string): MarkdownBlock[] {
  const lines = chunk.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line.trim());
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      i += 1;
      continue;
    }

    if (QUOTE.test(line.trimStart())) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]!.trimStart())) {
        quoted.push(QUOTE.exec(lines[i]!.trimStart())![1]!);
        i += 1;
      }
      blocks.push({ kind: 'quote', blocks: parseMarkdownBlocks(quoted.join('\n')) });
      continue;
    }

    if (BULLET.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i]!.trim())) {
        items.push(BULLET.exec(lines[i]!.trim())![1]!.trim());
        i += 1;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i]!;
      if (!current.trim()) break;
      const trimmed = current.trim();
      if (HEADING.test(trimmed) || BULLET.test(trimmed) || QUOTE.test(current.trimStart())) break;
      paragraph.push(trimmed);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}
