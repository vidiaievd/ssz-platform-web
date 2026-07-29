/** A sentence as offsets into the source text; `text === source.slice(start, end)`. */
export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/**
 * Norwegian abbreviations whose final period is not a sentence end.
 * Matched case-insensitively against the tail of the current fragment.
 */
const ABBREVIATIONS = [
  'f.eks.',
  'bl.a.',
  'm.m.',
  'o.l.',
  'dvs.',
  'osv.',
  'pga.',
  'ca.',
  'kl.',
  'nr.',
  'bl.',
  'jf.',
];

/** Terminal punctuation, optional closing quote/bracket, then whitespace before the next word. */
const BOUNDARY = /[.!?…]+["'»”’)\]]*(\s+)(?=\S)/gu;

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const UPPERCASE = /\p{Lu}/u;
const DIGIT = /\p{Nd}/u;

/**
 * Splits prose into sentences by punctuation, with the abbreviation, initial and
 * ordinal exceptions Norwegian lesson texts actually hit.
 *
 * `Intl.Segmenter` is deliberately not used: its `sentence` granularity differs
 * between engines and knows none of these abbreviations.
 *
 * Segments carry offsets rather than only text so a caller holding a position in
 * the source (the glossary tokenizer) can locate the sentence containing it.
 * Whitespace between sentences belongs to no segment — the returned `text` is
 * always the sentence itself, without padding.
 */
export function splitSentences(text: string): Sentence[] {
  const first = text.search(/\S/u);
  if (first === -1) return [{ text, start: 0, end: text.length }];

  const lastPlusOne = text.replace(/\s+$/u, '').length;

  const sentences: Sentence[] = [];
  let cursor = first;

  for (const match of text.matchAll(BOUNDARY)) {
    const punctStart = match.index;
    const punctEnd = punctStart + match[0].length - match[1]!.length;
    const nextStart = punctStart + match[0].length;

    if (punctStart < cursor) continue;
    if (isFalseBoundary(text, punctStart, punctEnd, nextStart)) continue;

    sentences.push({ text: text.slice(cursor, punctEnd), start: cursor, end: punctEnd });
    cursor = nextStart;
  }

  if (cursor < lastPlusOne) {
    sentences.push({ text: text.slice(cursor, lastPlusOne), start: cursor, end: lastPlusOne });
  }

  return sentences.length > 0 ? sentences : [{ text, start: 0, end: text.length }];
}

/** The sentence containing `offset`, falling back to the nearest preceding one. */
export function sentenceAt(sentences: Sentence[], offset: number): string {
  let fallback = sentences[0]?.text ?? '';
  for (const sentence of sentences) {
    if (offset < sentence.start) break;
    if (offset < sentence.end) return sentence.text;
    fallback = sentence.text;
  }
  return fallback;
}

/**
 * True when the period ends an abbreviation, an initial or an ordinal number
 * rather than a sentence. Only a bare `.` can be one of those — `!`, `?`, `…`
 * and anything followed by a closing bracket always terminate.
 */
function isFalseBoundary(text: string, punctStart: number, punctEnd: number, nextStart: number): boolean {
  if (punctEnd !== punctStart + 1 || text[punctStart] !== '.') return false;

  const head = text.slice(0, punctEnd).toLowerCase();
  for (const abbreviation of ABBREVIATIONS) {
    if (!head.endsWith(abbreviation)) continue;
    const before = head[head.length - abbreviation.length - 1];
    if (before === undefined || !WORD_CHAR.test(before)) return true;
  }

  // Initials: `A. Hansen` — a lone capital letter before the period.
  const prev = text[punctStart - 1];
  if (prev !== undefined && UPPERCASE.test(prev)) {
    const beforePrev = text[punctStart - 2];
    if (beforePrev === undefined || !WORD_CHAR.test(beforePrev)) return true;
  }

  // Ordinals: `1. januar`. A capitalised next word means the period really did
  // end a sentence (`Møtet er kl. 14. Vi ses der.`), so only lowercase suppresses.
  let i = punctStart - 1;
  while (i >= 0 && DIGIT.test(text[i]!)) i -= 1;
  if (i < punctStart - 1 && (i < 0 || !WORD_CHAR.test(text[i]!))) {
    const next = text[nextStart];
    if (next !== undefined && !UPPERCASE.test(next)) return true;
  }

  return false;
}
