export type InlineMarkKind = 'strong' | 'em';

/** An emphasis span, as offsets into the *stripped* text. */
export interface InlineMark {
  start: number;
  end: number;
  kind: InlineMarkKind;
}

export interface InlineMarkdown {
  /** The text with emphasis delimiters removed. */
  text: string;
  /** Emphasis spans, outermost first. May nest; never partially overlap. */
  marks: InlineMark[];
}

/**
 * Splits `**strong**` / `*em*` off the text, returning what to render plus where
 * the emphasis applies.
 *
 * Emphasis is returned as offsets rather than as a tree because the reader has a
 * second, independent segmentation of the same string — the glossary tokenizer.
 * Both consume the stripped text, so their spans compose by offset arithmetic;
 * a nested-element tree would force one of them to be re-run per fragment.
 *
 * Deliberately not supported: `_underscore_` emphasis (underscores appear inside
 * identifiers and media tokens in lesson bodies far more often than as
 * emphasis), links, images and code spans (no lesson body in either seeded
 * course uses them). Unmatched delimiters are left in the text verbatim.
 */
export function parseInlineMarkdown(raw: string): InlineMarkdown {
  return parseAt(raw, 0);
}

function parseAt(raw: string, offset: number): InlineMarkdown {
  let text = '';
  const marks: InlineMark[] = [];
  let i = 0;

  while (i < raw.length) {
    const strong = readDelimited(raw, i, '**');
    if (strong) {
      i = pushSpan(strong, 'strong');
      continue;
    }
    const em = readDelimited(raw, i, '*');
    if (em) {
      i = pushSpan(em, 'em');
      continue;
    }
    text += raw[i];
    i += 1;
  }

  return { text, marks };

  function pushSpan(span: { inner: string; nextIndex: number }, kind: InlineMarkKind): number {
    const start = offset + text.length;
    const parsed = parseAt(span.inner, start);
    marks.push({ start, end: start + parsed.text.length, kind });
    marks.push(...parsed.marks);
    text += parsed.text;
    return span.nextIndex;
  }
}

/**
 * Reads a `<delim>…<delim>` span starting at `i`, or returns null when there is
 * no non-empty closing delimiter. For `*`, a `**` at either end belongs to a
 * strong span and must not be mistaken for emphasis.
 */
function readDelimited(
  raw: string,
  i: number,
  delim: '*' | '**',
): { inner: string; nextIndex: number } | null {
  if (!raw.startsWith(delim, i)) return null;
  if (delim === '*' && raw.startsWith('**', i)) return null;

  const contentStart = i + delim.length;
  let close = raw.indexOf(delim, contentStart);
  if (delim === '*') {
    // `*em**` — skip a closing candidate that is really the head of a `**` run.
    while (close > -1 && raw.startsWith('**', close)) {
      close = raw.indexOf(delim, close + 2);
    }
  }
  if (close === -1 || close === contentStart) return null;

  return { inner: raw.slice(contentStart, close), nextIndex: close + delim.length };
}

/**
 * Cuts `[start, end)` into the longest runs sharing the same set of marks.
 * Used to render a glossary token whose word is only partly emphasised.
 */
export function sliceMarks(
  marks: InlineMark[],
  start: number,
  end: number,
): { start: number; end: number; kinds: InlineMarkKind[] }[] {
  const cuts = new Set([start, end]);
  for (const mark of marks) {
    if (mark.start > start && mark.start < end) cuts.add(mark.start);
    if (mark.end > start && mark.end < end) cuts.add(mark.end);
  }

  const bounds = [...cuts].sort((a, b) => a - b);
  const pieces: { start: number; end: number; kinds: InlineMarkKind[] }[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const from = bounds[i]!;
    const to = bounds[i + 1]!;
    pieces.push({
      start: from,
      end: to,
      kinds: marks.filter((m) => m.start <= from && m.end >= to).map((m) => m.kind),
    });
  }
  return pieces;
}
