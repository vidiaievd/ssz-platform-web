import { describe, expect, it } from 'vitest';

import { buildExercisePayload, parseExerciseToForm, minimalMcqValues } from './exercise-content';
import type { ExerciseFormValues } from '../schemas/exercise';

const base: ExerciseFormValues = {
  templateCode: 'multiple_choice',
  instructions: '',
  hint: '',
  difficultyLevel: undefined,
  mcQuestion: '',
  mcContext: '',
  mcOptions: [{ text: '' }, { text: '' }],
  mcCorrectIndex: 0,
  fibText: '',
  fibBlanks: [{ answers: '' }],
  fibWordBank: '',
  trSourceText: '',
  trSourceLanguage: '',
  trAcceptedTranslations: [{ text: '' }],
  mpPairs: [
    { left: '', right: '' },
    { left: '', right: '' },
  ],
};

describe('buildExercisePayload', () => {
  it('multiple_choice: builds options with ids and marks the correct one', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'multiple_choice',
      mcQuestion: 'Hva betyr "hei"?',
      mcOptions: [{ text: 'hello' }, { text: 'goodbye' }, { text: 'thanks' }],
      mcCorrectIndex: 2,
    });
    expect(content).toEqual({
      question: 'Hva betyr "hei"?',
      options: [
        { id: 'opt-0', text: 'hello' },
        { id: 'opt-1', text: 'goodbye' },
        { id: 'opt-2', text: 'thanks' },
      ],
    });
    expect(expectedAnswers).toEqual({ correct_option_ids: ['opt-2'] });
  });

  it('fill_in_blank: splits comma-separated accepted answers and 1-indexes blanks', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'fill_in_blank',
      fibText: 'Jeg ___1___ norsk og ___2___ engelsk.',
      fibBlanks: [{ answers: 'snakker' }, { answers: 'liker, elsker' }],
      fibWordBank: 'snakker, liker',
    });
    expect(content).toEqual({
      text_with_blanks: 'Jeg ___1___ norsk og ___2___ engelsk.',
      word_bank: ['snakker', 'liker'],
    });
    expect(expectedAnswers).toEqual({
      blanks: [
        { blank_id: 1, accepted_answers: ['snakker'] },
        { blank_id: 2, accepted_answers: ['liker', 'elsker'] },
      ],
    });
  });

  it('translate_to_target: includes source_language; translate_from_target omits it', () => {
    const to = buildExercisePayload({
      ...base,
      templateCode: 'translate_to_target',
      trSourceText: 'I speak Norwegian',
      trSourceLanguage: 'en',
      trAcceptedTranslations: [{ text: 'Jeg snakker norsk' }],
    });
    expect(to.content).toEqual({ source_text: 'I speak Norwegian', source_language: 'en' });
    expect(to.expectedAnswers).toEqual({ accepted_translations: ['Jeg snakker norsk'] });

    const from = buildExercisePayload({
      ...base,
      templateCode: 'translate_from_target',
      trSourceText: 'Jeg snakker norsk',
      trSourceLanguage: 'en',
      trAcceptedTranslations: [{ text: 'I speak Norwegian' }],
    });
    expect(from.content).toEqual({ source_text: 'Jeg snakker norsk' });
  });

  it('match_pairs: emits left/right items with ids and pairs mapping', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'match_pairs',
      mpPairs: [
        { left: 'hei', right: 'hello' },
        { left: 'takk', right: 'thanks' },
      ],
    });
    expect(content).toEqual({
      left_items: [
        { id: 'l-0', text: 'hei' },
        { id: 'l-1', text: 'takk' },
      ],
      right_items: [
        { id: 'r-0', text: 'hello' },
        { id: 'r-1', text: 'thanks' },
      ],
    });
    expect(expectedAnswers).toEqual({
      pairs: [
        { left_id: 'l-0', right_id: 'r-0' },
        { left_id: 'l-1', right_id: 'r-1' },
      ],
    });
  });
});

describe('build → parse round-trips', () => {
  const cases: Array<{ name: string; values: ExerciseFormValues }> = [
    {
      name: 'multiple_choice',
      values: {
        ...base,
        templateCode: 'multiple_choice',
        mcQuestion: 'Q?',
        mcContext: 'ctx',
        mcOptions: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
        mcCorrectIndex: 1,
      },
    },
    {
      name: 'fill_in_blank',
      values: {
        ...base,
        templateCode: 'fill_in_blank',
        fibText: 'Jeg ___1___ her.',
        fibBlanks: [{ answers: 'bor, er' }],
        fibWordBank: 'bor, er, går',
      },
    },
    {
      name: 'translate_to_target',
      values: {
        ...base,
        templateCode: 'translate_to_target',
        trSourceText: 'hello',
        trSourceLanguage: 'en',
        trAcceptedTranslations: [{ text: 'hei' }, { text: 'hallo' }],
      },
    },
    {
      name: 'match_pairs',
      values: {
        ...base,
        templateCode: 'match_pairs',
        mpPairs: [
          { left: 'hei', right: 'hello' },
          { left: 'takk', right: 'thanks' },
        ],
      },
    },
  ];

  for (const { name, values } of cases) {
    it(`${name} survives a build → parse round-trip`, () => {
      const { content, expectedAnswers } = buildExercisePayload(values);
      const parsed = parseExerciseToForm({ templateCode: values.templateCode, content, expectedAnswers });
      const rebuilt = buildExercisePayload(parsed);
      expect(rebuilt.content).toEqual(content);
      expect(rebuilt.expectedAnswers).toEqual(expectedAnswers);
    });
  }
});

describe('parseExerciseToForm', () => {
  it('falls back to multiple_choice for an unknown template code', () => {
    const parsed = parseExerciseToForm({ templateCode: 'mystery', content: {} });
    expect(parsed.templateCode).toBe('multiple_choice');
  });
});

describe('minimalMcqValues', () => {
  it('produces a valid two-option MCQ with the given question', () => {
    const values = minimalMcqValues('Practice');
    const { content, expectedAnswers } = buildExercisePayload(values);
    expect(content.question).toBe('Practice');
    expect((content.options as unknown[]).length).toBe(2);
    expect(expectedAnswers.correct_option_ids).toEqual(['opt-0']);
  });
});
