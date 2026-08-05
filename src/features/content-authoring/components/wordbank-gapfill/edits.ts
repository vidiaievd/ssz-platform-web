// Editing operations on a `word_bank_gap_fill` document, for the builder.
//
// Everything here is pure: document in, document out. The derived side of the model —
// gaps, labels, the bank, validity — belongs to `@/lib/shared-kernel/wordbank-gapfill`
// and is never duplicated; this file only rewrites what the teacher typed and delegates
// the consequences (dropped gap indices, orphaned explanations) to the kernel.
//
// Bracket parsing lives here rather than in the kernel on purpose: `[bestille]` is an
// authoring convenience of this screen, not a rule the server or the mobile client has
// any use for.

import {
  gapKey,
  gaps,
  pruneFeedback,
  tokens,
  withSentenceText,
  type GapKey,
  type Sentence,
  type WordBankGapFill,
} from '@/lib/shared-kernel/wordbank-gapfill';

/**
 * A sentence id. Only has to be unique within one exercise and stable across the edit
 * session — every `GapKey` is built from it, so it must never contain `#`.
 */
export function newSentenceId(): string {
  return `s${crypto.randomUUID().slice(0, 8)}`;
}

export function emptySentence(): Sentence {
  return { id: newSentenceId(), text: '', gaps: [] };
}

/** A token is bracketed when it carries both brackets, e.g. `[regningen],`. */
const BRACKETED = /\[[^\]]*\]/;

/**
 * Split `Kan jeg få [regningen], takk?` into the plain text and the indices of the
 * tokens that were bracketed. Brackets are stripped wherever they sit inside the token,
 * so punctuation outside them survives (`[regningen],` → `regningen,`) and the answer is
 * still derived by the kernel's `core`.
 */
export function extractBrackets(raw: string): { text: string; gaps: number[] } {
  if (!BRACKETED.test(raw)) return { text: raw, gaps: [] };

  const marked: number[] = [];
  const cleaned = tokens(raw).map((token, index) => {
    if (!token.includes('[') || !token.includes(']')) return token;
    marked.push(index);
    return token.replaceAll('[', '').replaceAll(']', '');
  });

  return { text: cleaned.join(' '), gaps: marked };
}

/**
 * Rewrite one sentence's text as the teacher types it.
 *
 * The text is only normalised when it contains brackets: rebuilding it from tokens on
 * every keystroke would collapse the space the teacher just typed and make the field
 * fight back. Gap indices the new text no longer reaches are dropped by the kernel,
 * together with their explanations.
 */
export function applySentenceText(
  ex: WordBankGapFill,
  sentenceId: string,
  raw: string,
): WordBankGapFill {
  const { text, gaps: marked } = extractBrackets(raw);
  const next = withSentenceText(ex, sentenceId, text);
  if (marked.length === 0) return next;

  return {
    ...next,
    sentences: next.sentences.map((sentence) =>
      sentence.id === sentenceId
        ? { ...sentence, gaps: [...new Set([...sentence.gaps, ...marked])] }
        : sentence,
    ),
  };
}

/**
 * Make a token a gap, or stop it being one.
 *
 * Un-gapping runs the kernel's prune, which takes the gap's explanations with it — and
 * any pair text keyed by a word that has just left the bank. The UI warns first when
 * there is something to lose (`explanationCount`).
 */
export function toggleGap(
  ex: WordBankGapFill,
  sentenceId: string,
  tokenIndex: number,
): WordBankGapFill {
  const sentences = ex.sentences.map((sentence) => {
    if (sentence.id !== sentenceId) return sentence;
    const has = sentence.gaps.includes(tokenIndex);
    return {
      ...sentence,
      gaps: has
        ? sentence.gaps.filter((index) => index !== tokenIndex)
        : [...sentence.gaps, tokenIndex].sort((a, b) => a - b),
    };
  });

  return pruneFeedback({ ...ex, sentences });
}

export function setSentenceHint(
  ex: WordBankGapFill,
  sentenceId: string,
  hint: string,
): WordBankGapFill {
  return {
    ...ex,
    sentences: ex.sentences.map((sentence) =>
      sentence.id === sentenceId ? { ...sentence, hint } : sentence,
    ),
  };
}

export function addSentence(ex: WordBankGapFill, sentence: Sentence): WordBankGapFill {
  return { ...ex, sentences: [...ex.sentences, sentence] };
}

export function addSentences(ex: WordBankGapFill, added: Sentence[]): WordBankGapFill {
  return { ...ex, sentences: [...ex.sentences, ...added] };
}

export function removeSentence(ex: WordBankGapFill, sentenceId: string): WordBankGapFill {
  return pruneFeedback({
    ...ex,
    sentences: ex.sentences.filter((sentence) => sentence.id !== sentenceId),
  });
}

/**
 * Move a sentence one place. Gap labels are positional, so this renumbers them
 * everywhere at once — nothing is stored to keep in step (AC-B7).
 */
export function moveSentence(
  ex: WordBankGapFill,
  index: number,
  direction: -1 | 1,
): WordBankGapFill {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ex.sentences.length) return ex;

  const sentences = [...ex.sentences];
  const [moved] = sentences.splice(index, 1);
  if (moved === undefined) return ex;
  sentences.splice(target, 0, moved);
  return { ...ex, sentences };
}

/** One sentence per line, brackets honoured — the `Paste several` path (AC-B4). */
export function sentencesFromPaste(raw: string): Sentence[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const { text, gaps: marked } = extractBrackets(line);
      return { id: newSentenceId(), text, gaps: marked };
    });
}

/**
 * How much authored explanation hangs on a gap: its default, its note on why the answer
 * is right, and every pair cell a human wrote. Counted so that removing the gap can say
 * what it will delete instead of doing it quietly — the one place the spec asks for a
 * warning, because unlike the coverage meter this text does not come back.
 *
 * AI drafts are not counted: an unaccepted draft is not something the teacher wrote.
 */
export function explanationCount(ex: WordBankGapFill, key: GapKey): number {
  const feedback = ex.feedback[key];
  if (feedback === undefined) return 0;

  const written = [feedback.fallback, feedback.why].filter((text) => text.trim() !== '').length;
  const pairs = Object.values(feedback.pairs).filter(
    (pair) => pair.origin === 'author' && pair.text.trim() !== '',
  ).length;

  return written + pairs;
}

/** The same count over every gap of one sentence — what deleting the card would cost. */
export function sentenceExplanationCount(ex: WordBankGapFill, sentenceId: string): number {
  return gaps(ex)
    .filter((gap) => gap.sentenceId === sentenceId)
    .reduce((sum, gap) => sum + explanationCount(ex, gap.key), 0);
}

/** The gap keys of one sentence, in token order. */
export function sentenceGapKeys(sentence: Sentence): GapKey[] {
  const limit = tokens(sentence.text).length;
  return [...new Set(sentence.gaps)]
    .filter((index) => index < limit)
    .sort((a, b) => a - b)
    .map((index) => gapKey(sentence.id, index));
}
