import type { ExerciseWithAnswers, LessonListeningStage } from '@/features/content/types';
import { isMultipleChoiceDocument } from '@/lib/shared-kernel/multiple-choice';

/**
 * content-service's `fill_in_blank`/`multiple_choice` template shapes are
 * snake_case (see `exercise-content.ts`, the authoring-side mapper for the
 * same templates). These parsers are the reader-side equivalent, restricted
 * to a single blank/answer per exercise — one gap or one question per
 * listening stage (BE1.3: `LessonListeningStage` is one exercise ref each).
 */

/**
 * Which lesson the staged exercises follow: the listening flow of an AUDIO
 * lesson, or the post-reading check of a TEXT one (spec 17 §5.5). The exercises
 * are identical — the surface only decides the copy and whether there is audio
 * to replay.
 */
export type StageSurface = 'audio' | 'text';

/**
 * A staged exercise these parsers were never taught to read.
 *
 * `multiple_choice` covers two live document shapes since plan 53: the single question
 * these stages are built around, and a set answered one question at a time against an
 * attempt. A stage pointing at a set parses to `null`, and a `null` used to mean one thing
 * only — the stage quietly vanished from the lesson, taking its question with it and
 * leaving no trace that anything was there. The pages ask this instead, so they can say
 * what happened rather than showing a shorter lesson.
 */
export function isUnsupportedStageDocument(display: ExerciseWithAnswers): boolean {
  return display.templateCode === 'multiple_choice' && isMultipleChoiceDocument(display.content);
}

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
