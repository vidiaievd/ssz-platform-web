import type { McqExpectedAnswers } from './mcq-body';
import type { FillExpectedAnswers } from './fill-body';
import type { MatchPair } from './match-body';
import type { ShortAnswerExpectedAnswers } from './short-answer-body';
import type { SentenceSchemaExpectedAnswers } from './sentence-schema-body';

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
