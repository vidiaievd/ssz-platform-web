import { describe, expect, it } from 'vitest';

import { containerFormSchema } from './container';
import { exerciseFormSchema } from './exercise';
import { grammarEditorFormSchema } from './grammar';
import { lessonFormSchema } from './lesson';

// ---------------------------------------------------------------------------
// containerFormSchema
// ---------------------------------------------------------------------------

describe('containerFormSchema', () => {
  const valid = {
    title: 'Norwegian A1',
    containerType: 'course' as const,
    targetLanguage: 'nb',
    difficultyLevel: 'A1' as const,
    visibility: 'public' as const,
    accessTier: 'public_free' as const,
  };

  it('accepts minimal valid data', () => {
    expect(containerFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts the optional description', () => {
    const full = { ...valid, description: 'An intro course.' };
    expect(containerFormSchema.safeParse(full).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(containerFormSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rejects an invalid containerType', () => {
    expect(containerFormSchema.safeParse({ ...valid, containerType: 'LESSON' }).success).toBe(
      false,
    );
  });

  it('rejects an invalid accessTier', () => {
    expect(containerFormSchema.safeParse({ ...valid, accessTier: 'PREMIUM' }).success).toBe(false);
  });

  it('rejects an invalid visibility', () => {
    expect(containerFormSchema.safeParse({ ...valid, visibility: 'everyone' }).success).toBe(false);
  });

  it('accepts an omitted levelSystem', () => {
    expect(containerFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a valid levelSystem', () => {
    expect(containerFormSchema.safeParse({ ...valid, levelSystem: 'single' }).success).toBe(true);
  });

  it('rejects an invalid levelSystem', () => {
    expect(containerFormSchema.safeParse({ ...valid, levelSystem: 'advanced' }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// lessonFormSchema
// ---------------------------------------------------------------------------

describe('lessonFormSchema', () => {
  it('accepts a title with no body', () => {
    expect(lessonFormSchema.safeParse({ title: 'Lesson 1' }).success).toBe(true);
  });

  it('accepts a title and body', () => {
    expect(lessonFormSchema.safeParse({ title: 'Lesson 1', body: '# Hello' }).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(lessonFormSchema.safeParse({ title: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// grammarEditorFormSchema
// ---------------------------------------------------------------------------

describe('grammarEditorFormSchema', () => {
  const valid = {
    ruleTitle: 'Present tense',
    languageCode: 'en',
    explanationTitle: 'How it works',
    examples: [],
  };

  it('accepts minimal valid data', () => {
    expect(grammarEditorFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts examples', () => {
    const withExamples = { ...valid, examples: [{ text: 'Jeg spiser' }, { text: 'Han løper' }] };
    expect(grammarEditorFormSchema.safeParse(withExamples).success).toBe(true);
  });

  it('rejects an empty ruleTitle', () => {
    expect(grammarEditorFormSchema.safeParse({ ...valid, ruleTitle: '' }).success).toBe(false);
  });

  it('rejects an empty explanationTitle', () => {
    expect(grammarEditorFormSchema.safeParse({ ...valid, explanationTitle: '' }).success).toBe(
      false,
    );
  });

  it('rejects an example with an empty text', () => {
    expect(grammarEditorFormSchema.safeParse({ ...valid, examples: [{ text: '' }] }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// exerciseFormSchema — superRefine per-type validation
// ---------------------------------------------------------------------------

describe('exerciseFormSchema', () => {
  // Instructions are required for every template — an exercise without one is
  // a publish blocker — so the per-template cases below supply one and vary
  // only the fields they are about.
  const parseExercise = (values: Record<string, unknown>) =>
    exerciseFormSchema.safeParse({ instructions: 'Do the exercise.', ...values });

  it('rejects an exercise with no instructions', () => {
    // Pre-flight raises `EXERCISE_INCOMPLETE` as a blocker for one, so the
    // author must not be able to save it in the first place.
    const result = exerciseFormSchema.safeParse({
      templateCode: 'multiple_choice',
      mcQuestion: 'Which word means hello?',
      mcOptions: [{ text: 'hei' }, { text: 'takk' }],
      mcCorrectIndex: 0,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('instructions');
  });

  it('multiple_choice: accepts valid data with question and 2+ options', () => {
    expect(
      parseExercise({
        templateCode: 'multiple_choice',
        mcQuestion: 'Which word means hello?',
        mcOptions: [{ text: 'hei' }, { text: 'takk' }],
        mcCorrectIndex: 0,
      }).success,
    ).toBe(true);
  });

  it('multiple_choice: rejects when mcQuestion is missing', () => {
    const result = parseExercise({
      templateCode: 'multiple_choice',
      mcOptions: [{ text: 'a' }, { text: 'b' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('mcQuestion');
  });

  it('multiple_choice: rejects when fewer than 2 options provided', () => {
    const result = parseExercise({
      templateCode: 'multiple_choice',
      mcQuestion: 'Pick one',
      mcOptions: [{ text: 'only one' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('mcOptions');
  });

  it('multiple_choice_group: accepts questions answering from the shared column', () => {
    expect(
      parseExercise({
        templateCode: 'multiple_choice_group',
        mcgSharedOptions: [{ text: 'Riktig' }, { text: 'Galt' }],
        mcgItems: [
          { question: 'Bartek søker jobb.', options: [], correctIndex: 0 },
          { question: 'Anne er sjefen hans.', options: [], correctIndex: 1 },
        ],
      }).success,
    ).toBe(true);
  });

  it('multiple_choice_group: accepts a question with options of its own and no shared column', () => {
    expect(
      parseExercise({
        templateCode: 'multiple_choice_group',
        mcgSharedOptions: [{ text: '' }, { text: '' }],
        mcgItems: [
          {
            question: 'selvstendig',
            options: [{ text: 'som kan jobbe alene' }, { text: 'som trenger hjelp' }],
            correctIndex: 0,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('multiple_choice_group: rejects a block with no question', () => {
    const result = parseExercise({
      templateCode: 'multiple_choice_group',
      mcgSharedOptions: [{ text: 'Riktig' }, { text: 'Galt' }],
      mcgItems: [{ question: '   ', options: [], correctIndex: 0 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('mcgItems');
  });

  it('multiple_choice_group: rejects a shared column of fewer than 2 options', () => {
    const result = parseExercise({
      templateCode: 'multiple_choice_group',
      mcgSharedOptions: [{ text: 'Riktig' }],
      mcgItems: [{ question: 'Bartek søker jobb.', options: [], correctIndex: 0 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('mcgSharedOptions');
  });

  it('multiple_choice_group: rejects a question left with a single option of its own', () => {
    const result = parseExercise({
      templateCode: 'multiple_choice_group',
      mcgSharedOptions: [{ text: 'Riktig' }, { text: 'Galt' }],
      mcgItems: [{ question: 'selvstendig', options: [{ text: 'alene' }], correctIndex: 0 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('mcgItems.0.options');
  });

  it('multiple_choice_group: rejects a correct answer outside the resolved options', () => {
    const result = parseExercise({
      templateCode: 'multiple_choice_group',
      mcgSharedOptions: [{ text: 'Riktig' }, { text: 'Galt' }],
      mcgItems: [{ question: 'Bartek søker jobb.', options: [], correctIndex: 2 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('mcgItems.0.correctIndex');
  });

  it('word_bank_fill: accepts a bank plus sentences with answered blanks', () => {
    expect(
      parseExercise({
        templateCode: 'word_bank_fill',
        wbfWordBank: 'show off, boast',
        wbfSentences: [
          { text: 'They ___1___ all the time.', answers: ['show off'] },
          { text: 'He ___1___ and she ___2___.', answers: ['boast', 'show off'] },
        ],
      }).success,
    ).toBe(true);
  });

  it('word_bank_fill: rejects a bank with fewer than 2 words', () => {
    const result = parseExercise({
      templateCode: 'word_bank_fill',
      wbfWordBank: 'show off',
      wbfSentences: [{ text: 'They ___1___.', answers: ['show off'] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wbfWordBank');
  });

  it('word_bank_fill: rejects a sentence without a blank marker', () => {
    const result = parseExercise({
      templateCode: 'word_bank_fill',
      wbfWordBank: 'show off, boast',
      wbfSentences: [{ text: 'No blank here.', answers: [''] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wbfSentences.0.text');
  });

  it('word_bank_fill: rejects a blank left without an answer', () => {
    const result = parseExercise({
      templateCode: 'word_bank_fill',
      wbfWordBank: 'show off, boast',
      wbfSentences: [{ text: 'He ___1___ and she ___2___.', answers: ['boast'] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wbfSentences.0.answers.1');
  });

  it('text_order: accepts two or more lines', () => {
    expect(
      parseExercise({
        templateCode: 'text_order',
        toKind: 'dialogue',
        toLines: [{ text: 'Hei.' }, { text: 'Hei igjen.' }],
      }).success,
    ).toBe(true);
  });

  it('text_order: rejects a single line', () => {
    const result = parseExercise({
      templateCode: 'text_order',
      toLines: [{ text: 'Hei.' }, { text: '  ' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('toLines');
  });

  it('error_correction: accepts split sentences with a numbered fix', () => {
    expect(
      parseExercise({
        templateCode: 'error_correction',
        ecSentences: [
          {
            chunks: 'They say | make your mind | about people',
            fixes: [{ chunkIndex: '2', accepted: 'make up your mind' }],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('error_correction: rejects a sentence that was never split', () => {
    const result = parseExercise({
      templateCode: 'error_correction',
      ecSentences: [
        {
          chunks: 'They say make your mind about people',
          fixes: [{ chunkIndex: '1', accepted: 'x' }],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('ecSentences.0.chunks');
  });

  it('error_correction: rejects a part number outside the sentence', () => {
    const result = parseExercise({
      templateCode: 'error_correction',
      ecSentences: [{ chunks: 'a | b', fixes: [{ chunkIndex: '5', accepted: 'x' }] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain(
      'ecSentences.0.fixes.0.chunkIndex',
    );
  });

  it('error_correction: rejects sentences with no mistake at all', () => {
    const result = parseExercise({
      templateCode: 'error_correction',
      ecSentences: [{ chunks: 'a | b', fixes: [{ chunkIndex: '', accepted: '' }] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('ecSentences');
  });

  it('fill_in_blank: accepts a text with at least one blank', () => {
    expect(
      parseExercise({
        templateCode: 'fill_in_blank',
        fibText: 'Jeg ___1___ norsk.',
        fibBlanks: [{ answers: 'snakker' }],
      }).success,
    ).toBe(true);
  });

  it('fill_in_blank: rejects when fibText is missing', () => {
    const result = parseExercise({
      templateCode: 'fill_in_blank',
      fibBlanks: [{ answers: 'x' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('fibText');
  });

  it('translate_to_target: accepts source text + at least one translation', () => {
    expect(
      parseExercise({
        templateCode: 'translate_to_target',
        trSourceText: 'I speak Norwegian',
        trAcceptedTranslations: [{ text: 'Jeg snakker norsk' }],
      }).success,
    ).toBe(true);
  });

  it('translate_from_target: rejects when no accepted translation provided', () => {
    const result = parseExercise({
      templateCode: 'translate_from_target',
      trSourceText: 'Jeg snakker norsk',
      trAcceptedTranslations: [{ text: ' ' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('trAcceptedTranslations');
  });

  it('match_pairs: accepts 2+ pairs', () => {
    expect(
      parseExercise({
        templateCode: 'match_pairs',
        mpPairs: [
          { left: 'hei', right: 'hello' },
          { left: 'takk', right: 'thanks' },
        ],
      }).success,
    ).toBe(true);
  });

  it('match_pairs: rejects fewer than 2 pairs', () => {
    const result = parseExercise({
      templateCode: 'match_pairs',
      mpPairs: [{ left: 'hei', right: 'hello' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('mpPairs');
  });

  it('short_answer: accepts a question with a reference answer', () => {
    expect(
      parseExercise({
        templateCode: 'short_answer',
        saQuestion: 'When did Anne hear the news?',
        saReferenceAnswer: 'On the radio.',
      }).success,
    ).toBe(true);
  });

  it('short_answer: rejects when the reference answer is missing', () => {
    const result = parseExercise({
      templateCode: 'short_answer',
      saQuestion: 'Q?',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('saReferenceAnswer');
  });

  it('writing_task: accepts a prompt', () => {
    expect(
      parseExercise({ templateCode: 'writing_task', wtPrompt: 'Write a letter.' }).success,
    ).toBe(true);
  });

  it('writing_task: rejects when the prompt is missing', () => {
    const result = parseExercise({ templateCode: 'writing_task' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wtPrompt');
  });

  it('sentence_schema: accepts a sentence with 2+ fields and assigned tokens', () => {
    expect(
      parseExercise({
        templateCode: 'sentence_schema',
        ssSentence: 'Lars har likt Lotte',
        ssSchemaType: 'main',
        ssFields: [{ label: 'Forfelt' }, { label: 'Verbal' }],
        ssTokens: [
          { text: 'Lars', fieldIndex: 0 },
          { text: 'har', fieldIndex: 1 },
        ],
      }).success,
    ).toBe(true);
  });

  it('sentence_schema: rejects a token assigned to an empty field', () => {
    const result = parseExercise({
      templateCode: 'sentence_schema',
      ssSentence: 'S',
      ssFields: [{ label: 'A' }, { label: '' }],
      ssTokens: [
        { text: 'x', fieldIndex: 0 },
        { text: 'y', fieldIndex: 1 }, // field 1 has an empty label
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('ssTokens');
  });
});
