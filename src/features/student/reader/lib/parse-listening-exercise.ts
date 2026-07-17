import type { ExerciseWithAnswers, LessonListeningStage } from '@/features/content/types';

/**
 * content-service's `fill_in_blank`/`multiple_choice` template shapes are
 * snake_case (see `exercise-content.ts`, the authoring-side mapper for the
 * same templates). These parsers are the reader-side equivalent, restricted
 * to a single blank/answer per exercise — one gap or one question per
 * listening stage (BE1.3: `LessonListeningStage` is one exercise ref each).
 */

export interface ListeningGapFillItem {
  exerciseId: string;
  position: number;
  before: string;
  after: string;
  wordBank: string[];
  answer: string;
}

export interface ListeningComprehensionItem {
  exerciseId: string;
  position: number;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
}

function splitBlank(text: string): { before: string; after: string } {
  const match = /^([\s\S]*?)___\d+___([\s\S]*)$/.exec(text);
  if (!match) return { before: text, after: '' };
  return { before: match[1] ?? '', after: match[2] ?? '' };
}

export function parseGapFillExercise(
  stage: LessonListeningStage,
  display: ExerciseWithAnswers,
): ListeningGapFillItem | null {
  const c = display.content;
  const textWithBlanks = typeof c.text_with_blanks === 'string' ? c.text_with_blanks : null;
  if (!textWithBlanks) return null;

  const wordBank = Array.isArray(c.word_bank) ? (c.word_bank as unknown[]).map(String) : [];
  const rawBlanks = Array.isArray(display.expectedAnswers.blanks)
    ? (display.expectedAnswers.blanks as Array<{ accepted_answers?: unknown }>)
    : [];
  const accepted = rawBlanks[0]?.accepted_answers;
  const answer = Array.isArray(accepted) && typeof accepted[0] === 'string' ? accepted[0] : null;
  if (!answer) return null;

  const { before, after } = splitBlank(textWithBlanks);
  return { exerciseId: stage.exerciseId, position: stage.position, before, after, wordBank, answer };
}

export function parseComprehensionExercise(
  stage: LessonListeningStage,
  display: ExerciseWithAnswers,
): ListeningComprehensionItem | null {
  const c = display.content;
  const question = typeof c.question === 'string' ? c.question : null;
  const rawOptions = Array.isArray(c.options) ? c.options : null;
  if (!question || !rawOptions) return null;

  const options = rawOptions.filter(
    (o): o is { id: string; text: string } =>
      typeof (o as Record<string, unknown>).id === 'string' &&
      typeof (o as Record<string, unknown>).text === 'string',
  );
  const correctOptionId = Array.isArray(display.expectedAnswers.correct_option_ids)
    ? (display.expectedAnswers.correct_option_ids as unknown[])[0]
    : undefined;
  if (options.length === 0 || typeof correctOptionId !== 'string') return null;

  return { exerciseId: stage.exerciseId, position: stage.position, question, options, correctOptionId };
}
