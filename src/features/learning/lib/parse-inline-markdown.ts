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
  /**
   * Where each character of `text` sits in `raw`: `sourceIndexOf[i]` is the
   * index in `raw` of output character `i`. Length is `text.length + 1`; the
   * extra trailing entry is `raw.length`.
   *
   * Exists because lesson text spans are stored as offsets into raw paragraph
   * markdown (spec 16 §2.1) while this is the string the reader renders;
   * composing this map with the block parser's projects one onto the other.
   *
   * Non-decreasing. Every non-whitespace output character equals the input
   * character it maps to.
   *
   * **`sourceIndexOf[b]` is not the exclusive end of the output range
   * `[a, b)`.** It is the position of the character *after* the range, and
   * anything the parser dropped in between — a closing `**`, a `> ` prefix —
   * lies before it. The input range that output `[a, b)` covers ends at
   * `sourceIndexOf[b - 1] + 1`. The distinction is invisible whenever the range
   * is followed by ordinary text and wrong exactly when it abuts markup.
   */
  sourceIndexOf: number[];
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
  const parsed = parseAt(raw, 0);
  // The recursion returns one entry per character; the exclusive-end entry is
  // added once, here, so nested results concatenate without a seam.
  return { ...parsed, sourceIndexOf: [...parsed.sourceIndexOf, raw.length] };
}

function parseAt(raw: string, offset: number): InlineMarkdown {
  let text = '';
  const marks: InlineMark[] = [];
  const sourceIndexOf: number[] = [];
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
    sourceIndexOf.push(i);
    text += raw[i];
    i += 1;
  }

  return { text, marks, sourceIndexOf };

  function pushSpan(span: DelimitedSpan, kind: InlineMarkKind): number {
    const start = offset + text.length;
    const parsed = parseAt(span.inner, start);
    marks.push({ start, end: start + parsed.text.length, kind });
    marks.push(...parsed.marks);
    text += parsed.text;
    // The nested map indexes `span.inner`; shift it into `raw`'s coordinates.
    for (const index of parsed.sourceIndexOf) sourceIndexOf.push(span.contentStart + index);
    return span.nextIndex;
  }
}

interface DelimitedSpan {
  inner: string;
  /** Index in `raw` of `inner[0]` — where the opening delimiter ends. */
  contentStart: number;
  /** Index in `raw` to resume from — one past the closing delimiter. */
  nextIndex: number;
}

/**
 * Reads a `<delim>…<delim>` span starting at `i`, or returns null when there is
 * no non-empty closing delimiter. For `*`, a `**` at either end belongs to a
 * strong span and must not be mistaken for emphasis.
 */
function readDelimited(raw: string, i: number, delim: '*' | '**'): DelimitedSpan | null {
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

  return { inner: raw.slice(contentStart, close), contentStart, nextIndex: close + delim.length };
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
