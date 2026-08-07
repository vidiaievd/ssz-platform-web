// Where AI-drafted explanations attach — plan 35 step 7.2.
//
// No generation happens here and none is planned in this step. What is here is the
// shape of the request a generator would need, and the two operations a teacher
// performs on a draft, so that the day generation is added nothing about the stored
// document has to change: `origin: 'ai_draft'` has been written since the first commit
// of this template, and the kernel has always refused to count a draft as coverage.

import type { Gap, WordBankGapFill } from '@/lib/shared-kernel/wordbank-gapfill';

import { setPairText } from './edits';

/**
 * Everything a generator would need to write one pair explanation.
 *
 * The grammar point is in here because it is what makes the difference between "«bestilt»
 * is wrong" and "«bestilt» is the past participle, and after «vil gjerne» the verb stays
 * in the infinitive". The platform already knows it: `GrammarRuleExercisePool` links an
 * exercise to the rule it practises (34-exercise-types-audit §2 — built, and unused).
 * The builder does not fetch it yet; the field exists so the day it does, callers and
 * generator already agree on what the request looks like.
 */
export interface PairDraftContext {
  /** The sentence, solved, as the teacher wrote it. */
  sentence: string;
  /** The word that belongs in the gap. */
  answer: string;
  /** The wrong word this explanation is about. */
  chosenWord: string;
  /** The gap's default explanation, when there is one — the tone to match. */
  fallback: string | null;
  /** Title of the grammar rule the exercise practises, when the module has one. */
  grammarPoint?: string;
}

export function pairDraftContext(
  exercise: WordBankGapFill,
  gap: Gap,
  chosenWord: string,
  grammarPoint?: string,
): PairDraftContext {
  const fallback = exercise.feedback[gap.key]?.fallback.trim() ?? '';

  return {
    sentence: gap.sentence,
    answer: gap.answer,
    chosenWord,
    fallback: fallback === '' ? null : fallback,
    ...(grammarPoint === undefined ? {} : { grammarPoint }),
  };
}

/**
 * Accept a draft: the same text, now the teacher's.
 *
 * Accepting is not a flag on the draft, it is authorship changing hands — which is why
 * it goes through the ordinary pair editor. From here on the text counts towards
 * coverage and reaches students, and nothing records that a machine typed it first.
 */
export function acceptDraft(
  exercise: WordBankGapFill,
  gapKey: string,
  word: string,
): WordBankGapFill {
  const draft = exercise.feedback[gapKey]?.pairs[word];
  if (draft === undefined || draft.origin !== 'ai_draft') return exercise;
  return setPairText(exercise, gapKey, word, draft.text);
}

/** Reject a draft: the cell goes back to empty, and the gap's default applies again. */
export function rejectDraft(
  exercise: WordBankGapFill,
  gapKey: string,
  word: string,
): WordBankGapFill {
  const draft = exercise.feedback[gapKey]?.pairs[word];
  if (draft === undefined || draft.origin !== 'ai_draft') return exercise;
  return setPairText(exercise, gapKey, word, '');
}

/** The pending draft for a pair, or `null` when there is none. */
export function draftFor(exercise: WordBankGapFill, gapKey: string, word: string): string | null {
  const pair = exercise.feedback[gapKey]?.pairs[word];
  if (pair === undefined || pair.origin !== 'ai_draft') return null;
  return pair.text.trim() === '' ? null : pair.text;
}
