import type { McqExpectedAnswers } from './mcq-body';
import type { FillExpectedAnswers } from './fill-body';
import type { MatchPair } from './match-body';
import type { ShortAnswerExpectedAnswers } from './short-answer-body';
import type { SentenceSchemaExpectedAnswers } from './sentence-schema-body';
import type { TextOrderExpectedAnswers, TextOrderResults } from './text-order-body';
import type {
  ChunkResult,
  ErrorCorrectionExpected,
  ErrorCorrectionResults,
  ErrorCorrectionValue,
} from './error-correction-body';
import type {
  WordBankFillExpectedAnswers,
  WordBankFillResults,
  WordBankFillValue,
} from './word-bank-fill-body';

export interface TranslateExpectedAnswers {
  /** One or more acceptable translations, compared after normalization. */
  accepted_answers: string[];
}

/**
 * Canonical normalization per BEHAVIOR.md §4:
 * trim → lowercase → strip single trailing `. , ! ? ;` → collapse whitespace.
 */
export function normAnswer(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;]+$/, '')
    .replace(/\s+/g, ' ');
}

/** Grade a multiple-choice question. */
export function gradeMcq(
  expectedAnswers: McqExpectedAnswers,
  selectedId: string | null,
): boolean {
  if (!selectedId) return false;
  return expectedAnswers.correct_option_ids.includes(selectedId);
}

/**
 * Grade a fill-in-the-blank.
 * `blankIndex` is the 1-based key in `FillExpectedAnswers.answers` (defaults to `"1"`).
 */
export function gradeFill(
  expectedAnswers: FillExpectedAnswers,
  value: string,
  blankIndex = '1',
): boolean {
  const expected = expectedAnswers.answers[blankIndex];
  if (!expected) return false;
  return normAnswer(value) === normAnswer(expected);
}

/** Grade a translation against an accept-list; any normalized match is correct. */
export function gradeTranslate(
  expectedAnswers: TranslateExpectedAnswers,
  value: string,
): boolean {
  const norm = normAnswer(value);
  return expectedAnswers.accepted_answers.some((a) => normAnswer(a) === norm);
}

/**
 * Grade a match exercise — all pairs must be linked to their own ID.
 * Returns false if any pair is missing or crossed.
 */
export function gradeMatch(
  pairs: MatchPair[],
  links: Record<string, string>,
): boolean {
  return pairs.every((p) => links[p.id] === p.id);
}

/**
 * Grade a short answer. Mirrors the engine: an exact (normalized) match of an
 * `accepted_answers` shortcut is correct; anything else needs human/LLM review,
 * so we return `null` rather than marking it wrong.
 */
export function gradeShortAnswer(
  expectedAnswers: ShortAnswerExpectedAnswers,
  value: string,
): boolean | null {
  const accepted = expectedAnswers.accepted_answers ?? [];
  if (accepted.length === 0) return null;
  const norm = normAnswer(value);
  if (norm === '') return null;
  return accepted.some((a) => normAnswer(a) === norm) ? true : null;
}

/**
 * Grade a sentence-schema exercise — every field's ordered token list must
 * match the expected placement exactly.
 */
export function gradeSentenceSchema(
  expectedAnswers: SentenceSchemaExpectedAnswers,
  value: Record<string, string[]>,
): boolean {
  return expectedAnswers.placements.every((p) => {
    const submitted = value[p.field_id] ?? [];
    return (
      submitted.length === p.token_ids.length &&
      p.token_ids.every((id, i) => id === submitted[i])
    );
  });
}

/**
 * Grade a shared-word-bank gap-fill. Mirrors the engine's WordBankFillValidator:
 * every expected blank is compared, and one the learner left empty counts as
 * wrong instead of dropping out of the total.
 */
export function checkWordBankFill(
  expectedAnswers: WordBankFillExpectedAnswers,
  value: WordBankFillValue,
): { ok: boolean; results: WordBankFillResults; correct: number; total: number } {
  const results: WordBankFillResults = {};
  let correctCount = 0;
  let total = 0;

  for (const item of expectedAnswers.items) {
    for (const blank of item.blanks) {
      const submitted = value[item.id]?.[blank.blank_id] ?? '';
      const correct =
        submitted !== '' &&
        blank.accepted_answers.some((a) => normAnswer(a) === normAnswer(submitted));

      results[item.id] = {
        ...(results[item.id] ?? {}),
        [blank.blank_id]: {
          correct,
          expected: blank.accepted_answers[0] ?? '',
          ...(blank.rationale ? { rationale: blank.rationale } : {}),
        },
      };
      total += 1;
      if (correct) correctCount += 1;
    }
  }

  return { ok: total > 0 && correctCount === total, results, correct: correctCount, total };
}

/**
 * Grade an ordering exercise. Mirrors the engine's TextOrderValidator: an item
 * counts as correct when it sits in its own slot, and an arrangement with the
 * wrong number of items is never fully correct.
 */
export function checkTextOrder(
  expectedAnswers: TextOrderExpectedAnswers,
  value: string[],
): { ok: boolean; results: TextOrderResults; correct: number; total: number } {
  const results: TextOrderResults = {};
  let correctCount = 0;

  expectedAnswers.order.forEach((id, expectedIndex) => {
    const correct = value.indexOf(id) === expectedIndex;
    results[id] = correct;
    if (correct) correctCount += 1;
  });

  const total = expectedAnswers.order.length;
  return {
    ok: value.length === total && correctCount === total,
    results,
    correct: correctCount,
    total,
  };
}

/**
 * Grade a find-and-correct exercise. Mirrors the engine's
 * ErrorCorrectionValidator: a point needs both the right chunk and an
 * acceptable rewrite, and rewriting a sound chunk costs one.
 */
export function checkErrorCorrection(
  expectedAnswers: ErrorCorrectionExpected,
  value: ErrorCorrectionValue,
): {
  ok: boolean;
  results: ErrorCorrectionResults;
  correct: number;
  total: number;
  falsePositives: number;
} {
  const results: ErrorCorrectionResults = {};
  const put = (itemId: string, chunkId: string, result: ChunkResult) => {
    results[itemId] = { ...(results[itemId] ?? {}), [chunkId]: result };
  };

  // Copy of the learner's edits; expected chunks are removed as they're seen,
  // so whatever is left over was a sound chunk they rewrote anyway.
  const remaining = new Map<string, string>();
  for (const [itemId, byChunk] of Object.entries(value)) {
    for (const [chunkId, text] of Object.entries(byChunk)) {
      if (text.trim() !== '') remaining.set(`${itemId} ${chunkId}`, text);
    }
  }

  let fixed = 0;
  for (const correction of expectedAnswers.corrections) {
    const key = `${correction.item_id} ${correction.chunk_id}`;
    const answer = remaining.get(key);
    remaining.delete(key);
    const base = { expected: correction.accepted[0] ?? '', note: correction.note };

    if (answer === undefined) {
      put(correction.item_id, correction.chunk_id, { ...base, outcome: 'missed' });
      continue;
    }
    const isFixed = correction.accepted.some((a) => normAnswer(a) === normAnswer(answer));
    if (isFixed) fixed += 1;
    put(correction.item_id, correction.chunk_id, {
      ...base,
      outcome: isFixed ? 'fixed' : 'wrong_fix',
    });
  }

  for (const key of remaining.keys()) {
    const [itemId = '', chunkId = ''] = key.split(' ');
    put(itemId, chunkId, { outcome: 'false_positive' });
  }

  const total = expectedAnswers.corrections.length;
  const falsePositives = remaining.size;
  return {
    ok: total > 0 && fixed === total && falsePositives === 0,
    results,
    correct: Math.max(0, fixed - falsePositives),
    total,
    falsePositives,
  };
}
