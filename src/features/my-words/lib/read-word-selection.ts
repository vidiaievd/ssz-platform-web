import { sentenceAt, splitSentences } from '@/features/learning/lib/split-sentences';

/** The attribute a capturable paragraph carries, its value being the paragraph's index. */
export const CAPTURE_PARAGRAPH_ATTR = 'data-capture-paragraph';

/** One word: letters, with inner hyphens or apostrophes («e-post»). Phrases are refused (plan 75, Q2). */
const ONE_WORD = /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u;

export interface WordSelection {
  surfaceForm: string;
  paragraphIndex: number;
  contextSentence: string;
  /** Where to put the «add» button: the selection's box in viewport coordinates. */
  rect: { top: number; left: number; width: number; bottom: number };
}

/**
 * A selection the reader made over a single word of a capturable paragraph inside `root`,
 * or null — nothing selected, a phrase, or a selection outside the text (the translation
 * column, the rail, two paragraphs at once).
 */
export function readWordSelection(
  selection: Selection | null,
  root: HTMLElement,
): WordSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const raw = selection.toString();
  const surfaceForm = raw.trim();
  if (!ONE_WORD.test(surfaceForm)) return null;

  const range = selection.getRangeAt(0);
  const anchor = range.commonAncestorContainer;
  const element = anchor instanceof Element ? anchor : anchor.parentElement;
  const paragraph = element?.closest<HTMLElement>(`[${CAPTURE_PARAGRAPH_ATTR}]`);
  if (!paragraph || !root.contains(paragraph)) return null;

  const paragraphIndex = Number(paragraph.getAttribute(CAPTURE_PARAGRAPH_ATTR));
  if (!Number.isInteger(paragraphIndex)) return null;

  // Offset of the word in the paragraph's rendered text: everything before the selection,
  // plus whatever whitespace a double-click dragged in ahead of the word.
  const before = document.createRange();
  before.selectNodeContents(paragraph);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length + (raw.length - raw.trimStart().length);
  const text = paragraph.textContent ?? '';

  // jsdom has no layout; a browser always has the method.
  const box =
    typeof range.getBoundingClientRect === 'function'
      ? range.getBoundingClientRect()
      : { top: 0, left: 0, width: 0, bottom: 0 };
  return {
    surfaceForm,
    paragraphIndex,
    contextSentence: sentenceAt(splitSentences(text), start).trim(),
    rect: { top: box.top, left: box.left, width: box.width, bottom: box.bottom },
  };
}
