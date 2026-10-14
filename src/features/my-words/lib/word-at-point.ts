import { sentenceAt, splitSentences } from '@/features/learning/lib/split-sentences';

/** The attribute a capturable paragraph carries, its value being the paragraph's index. */
export const CAPTURE_PARAGRAPH_ATTR = 'data-capture-paragraph';

const LETTER = /[\p{L}\p{M}]/u;
/** Joins letters inside a word — «e-post», «bil'n» — never at its edge. */
const JOINER = /['’-]/u;

export interface CapturedWord {
  surfaceForm: string;
  paragraphIndex: number;
  contextSentence: string;
  /** The word's own range, to highlight it while the menu is open. */
  range: Range;
}

function isWordChar(text: string, i: number): boolean {
  const ch = text[i];
  if (ch === undefined) return false;
  if (LETTER.test(ch)) return true;
  return JOINER.test(ch) && LETTER.test(text[i - 1] ?? '') && LETTER.test(text[i + 1] ?? '');
}

/**
 * The whole word at `offset` of a text node inside a capturable paragraph of `root`, or
 * null — not on a word, or outside the text (the translation column, the rail). Whatever
 * part of the word the pointer is on, the word comes back whole.
 */
export function wordAt(node: Node, offset: number, root: HTMLElement): CapturedWord | null {
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? '';

  let start = offset;
  // A caret placed by the right half of a word's last letter sits just past it.
  if (!isWordChar(text, start) && isWordChar(text, start - 1)) start -= 1;
  if (!isWordChar(text, start)) return null;
  let end = start;
  while (start > 0 && isWordChar(text, start - 1)) start -= 1;
  while (end < text.length && isWordChar(text, end)) end += 1;

  const paragraph = node.parentElement?.closest<HTMLElement>(`[${CAPTURE_PARAGRAPH_ATTR}]`);
  if (!paragraph || !root.contains(paragraph)) return null;
  const paragraphIndex = Number(paragraph.getAttribute(CAPTURE_PARAGRAPH_ATTR));
  if (!Number.isInteger(paragraphIndex)) return null;

  const before = document.createRange();
  before.selectNodeContents(paragraph);
  before.setEnd(node, start);
  const paragraphText = paragraph.textContent ?? '';

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);

  return {
    surfaceForm: text.slice(start, end),
    paragraphIndex,
    contextSentence: sentenceAt(splitSentences(paragraphText), before.toString().length).trim(),
    range,
  };
}

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

/**
 * The word under a viewport point. The caret APIs answer with the nearest caret even far
 * past a line's end, so the word's own boxes must hold the point — a click in the margin
 * is no click on the line's last word.
 */
export function wordAtPoint(x: number, y: number, root: HTMLElement): CapturedWord | null {
  const doc = document as CaretDocument;
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (position) ({ offsetNode: node, offset } = position);
  } else if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node) return null;

  const word = wordAt(node, offset, root);
  if (!word) return null;
  const hit = Array.from(word.range.getClientRects()).some(
    (box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
  );
  return hit ? word : null;
}
