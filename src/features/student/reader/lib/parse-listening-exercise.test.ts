import { describe, expect, it } from 'vitest';

import type { ExerciseWithAnswers, LessonListeningStage } from '@/features/content/types';
import { isUnsupportedStageDocument, parseComprehensionExercise } from './parse-listening-exercise';

const STAGE = {
  id: 'stage-1',
  lessonId: 'lsn-1',
  exerciseId: 'exc-1',
  stageType: 'comprehension',
  position: 0,
} as unknown as LessonListeningStage;

function display(
  templateCode: string,
  content: Record<string, unknown>,
  expectedAnswers: Record<string, unknown> = {},
): ExerciseWithAnswers {
  return { id: 'exc-1', templateCode, content, expectedAnswers } as unknown as ExerciseWithAnswers;
}

const OLD_FORM = display(
  'multiple_choice',
  {
    question: 'Hvor jobber Kari?',
    options: [
      { id: 'o1', text: 'På sykehuset' },
      { id: 'o2', text: 'På skolen' },
    ],
  },
  { correct_option_ids: ['o1'] },
);

const SET = display('multiple_choice', {
  title: '',
  instruction: 'Velg riktig svar.',
  questions: [{ id: 'q1', kind: 'reading', context: '', stem: 'Hvor jobber Kari?', options: [] }],
  settings: {},
});

describe('parseComprehensionExercise', () => {
  it('reads the single-question form the stages are built around', () => {
    const item = parseComprehensionExercise(STAGE, OLD_FORM);

    expect(item?.question).toBe('Hvor jobber Kari?');
    expect(item?.correctOptionId).toBe('o1');
  });

  it('refuses a set — there is no single question to stage', () => {
    expect(parseComprehensionExercise(STAGE, SET)).toBeNull();
  });
});

describe('isUnsupportedStageDocument', () => {
  // The pages count these instead of filtering them away in silence: a stage that
  // vanishes takes its question with it and leaves the lesson quietly shorter.
  it('recognises a multiple-choice set', () => {
    expect(isUnsupportedStageDocument(SET)).toBe(true);
  });

  it('leaves the old form alone', () => {
    expect(isUnsupportedStageDocument(OLD_FORM)).toBe(false);
  });

  it('asks the template code too — another template may keep questions in an array', () => {
    const shortAnswerSet = display('short_answer', { questions: [{ id: 'q1' }] });

    expect(isUnsupportedStageDocument(shortAnswerSet)).toBe(false);
  });
});
