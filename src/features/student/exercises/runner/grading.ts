import type { McqExpectedAnswers } from './mcq-body';
import type { FillExpectedAnswers } from './fill-body';
import type { MatchPair } from './match-body';
import type { SentenceSchemaExpectedAnswers } from './sentence-schema-body';
import type { TextOrderExpectedAnswers, TextOrderResults } from './text-order-body';
import type {
  WordBankFillExpectedAnswers,
  WordBankFillResults,
  WordBankFillValue,
} from './word-bank-fill-body';
import type { McqGroupExpectedAnswers, McqGroupResults, McqGroupValue } from './mcq-group-body';

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
export function gradeMcq(expectedAnswers: McqExpectedAnswers, selectedId: string | null): boolean {
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
export function gradeTranslate(expectedAnswers: TranslateExpectedAnswers, value: string): boolean {
  const norm = normAnswer(value);
  return expectedAnswers.accepted_answers.some((a) => normAnswer(a) === norm);
}

/**
 * Grade a match exercise — all pairs must be linked to their own ID.
 * Returns false if any pair is missing or crossed.
 */
export function gradeMatch(pairs: MatchPair[], links: Record<string, string>): boolean {
  return pairs.every((p) => links[p.id] === p.id);
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
      submitted.length === p.token_ids.length && p.token_ids.every((id, i) => id === submitted[i])
    );
  });
}

/**
 * Grade a block of multiple-choice questions. Mirrors the engine's
 * MultipleChoiceGroupValidator: a question is right only when the pick matches
 * its key exactly, and one left unanswered counts as wrong rather than
 * shrinking the total.
 */
export function checkMcqGroup(
  expectedAnswers: McqGroupExpectedAnswers,
  value: McqGroupValue,
): { ok: boolean; results: McqGroupResults; correct: number; total: number } {
  const results: McqGroupResults = {};
  let correctCount = 0;

  for (const item of expectedAnswers.items) {
    const picked = value[item.id];
    // The body offers one pick per question, so a key listing several options
    // can never be satisfied here — same verdict the engine reaches, which
    // compares the two sets whole.
    const correct = item.correct_option_ids.length === 1 && picked === item.correct_option_ids[0];

    results[item.id] = {
      correct,
      expected: item.correct_option_ids[0] ?? '',
      ...(item.explanation ? { explanation: item.explanation } : {}),
    };
    if (correct) correctCount += 1;
  }

  const total = expectedAnswers.items.length;
  return { ok: total > 0 && correctCount === total, results, correct: correctCount, total };
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
