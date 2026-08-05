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
  answers,
  equals,
  gapKey,
  gaps,
  pruneFeedback,
  tokens,
  withSentenceText,
  type GapKey,
  type InputMode,
  type Sentence,
  type Settings,
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

// ── Step 2 — the word bank ──────────────────────────────────────────────────

/** "bestilt, bestilling" → two words, blanks and repeats dropped. */
export function splitDistractors(raw: string): string[] {
  const seen: string[] = [];
  for (const part of raw.split(',')) {
    const word = part.trim();
    if (word !== '' && !seen.includes(word)) seen.push(word);
  }
  return seen;
}

/**
 * Why a word cannot join the bank: it is already an answer (the `BANK_DUPLICATE`
 * blocker, caught at the input before it is added — AC-B9), or it is already a
 * distractor. `null` means it can.
 */
export function distractorProblem(
  ex: WordBankGapFill,
  word: string,
): 'answer' | 'duplicate' | null {
  const { caseSensitive } = ex.settings;
  if (answers(ex).some((answer) => equals(answer, word, caseSensitive))) return 'answer';
  if (ex.distractors.some((existing) => equals(existing, word, caseSensitive))) return 'duplicate';
  return null;
}

/** Add every word that can be added; the caller has already reported the ones that cannot. */
export function addDistractors(ex: WordBankGapFill, raw: string): WordBankGapFill {
  const added = splitDistractors(raw).filter((word) => distractorProblem(ex, word) === null);
  return added.length === 0 ? ex : { ...ex, distractors: [...ex.distractors, ...added] };
}

/**
 * Drop a distractor, and with it the pair explanations written against it — the column
 * leaves the matrix and the coverage total shrinks (AC-B11). The kernel's prune is what
 * decides that, so removing a word here and removing it by renaming an answer in step 1
 * cannot diverge.
 */
export function removeDistractor(ex: WordBankGapFill, word: string): WordBankGapFill {
  return pruneFeedback({
    ...ex,
    distractors: ex.distractors.filter((existing) => existing !== word),
  });
}

export function setSettings(ex: WordBankGapFill, patch: Partial<Settings>): WordBankGapFill {
  return { ...ex, settings: { ...ex.settings, ...patch } };
}

/**
 * Switch between choosing from a bank and typing.
 *
 * Nothing is deleted on the way to `free`: the distractors and the pair matrix stay, and
 * are simply not shown to a student who types (plan step 4.2). A teacher who tries the
 * other mode and comes back finds their work where they left it; the price is a warning
 * — `FB_PAIRS_UNUSED` — that pairs written for a bank will not be seen.
 */
export function setInputMode(ex: WordBankGapFill, input: InputMode): WordBankGapFill {
  return setSettings(ex, { input });
}

/**
 * The extra spellings accepted for one gap in free-type mode (plan decision 3). Stored
 * per gap key, so they follow the gap and are pruned with it.
 */
export function setAlternatives(ex: WordBankGapFill, key: GapKey, raw: string): WordBankGapFill {
  const words = splitDistractors(raw);
  const alternatives = { ...(ex.alternatives ?? {}) };

  if (words.length === 0) delete alternatives[key];
  else alternatives[key] = words;

  return Object.keys(alternatives).length === 0 && ex.alternatives === undefined
    ? ex
    : { ...ex, alternatives };
}

/** One gap's accepted alternatives as the teacher typed them back into the field. */
export function alternativesText(ex: WordBankGapFill, key: GapKey): string {
  return (ex.alternatives?.[key] ?? []).join(', ');
}

/**
 * Answers that fill more than one gap. With `allowReuse` off such a word is spent on the
 * first gap and the rest cannot be solved at all, so the step says so (AC-B13).
 */
export function reusedAnswers(ex: WordBankGapFill): string[] {
  const counts = new Map<string, number>();
  for (const gap of gaps(ex)) {
    counts.set(gap.answer, (counts.get(gap.answer) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([word]) => word);
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
