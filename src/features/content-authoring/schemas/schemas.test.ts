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
    expect(containerFormSchema.safeParse({ ...valid, containerType: 'LESSON' }).success).toBe(false);
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
    expect(containerFormSchema.safeParse({ ...valid, levelSystem: 'advanced' }).success).toBe(false);
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
    expect(
      grammarEditorFormSchema.safeParse({ ...valid, examples: [{ text: '' }] }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// exerciseFormSchema — superRefine per-type validation
// ---------------------------------------------------------------------------

describe('exerciseFormSchema', () => {
  it('multiple_choice: accepts valid data with question and 2+ options', () => {
    expect(
      exerciseFormSchema.safeParse({
        templateCode: 'multiple_choice',
        mcQuestion: 'Which word means hello?',
        mcOptions: [{ text: 'hei' }, { text: 'takk' }],
        mcCorrectIndex: 0,
      }).success,
    ).toBe(true);
  });

  it('multiple_choice: rejects when mcQuestion is missing', () => {
    const result = exerciseFormSchema.safeParse({
      templateCode: 'multiple_choice',
      mcOptions: [{ text: 'a' }, { text: 'b' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('mcQuestion');
  });

  it('multiple_choice: rejects when fewer than 2 options provided', () => {
    const result = exerciseFormSchema.safeParse({
      templateCode: 'multiple_choice',
      mcQuestion: 'Pick one',
      mcOptions: [{ text: 'only one' }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('mcOptions');
  });

  it('word_bank_fill: accepts a bank plus sentences with answered blanks', () => {
    expect(
      exerciseFormSchema.safeParse({
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
    const result = exerciseFormSchema.safeParse({
      templateCode: 'word_bank_fill',
      wbfWordBank: 'show off',
      wbfSentences: [{ text: 'They ___1___.', answers: ['show off'] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wbfWordBank');
  });

  it('word_bank_fill: rejects a sentence without a blank marker', () => {
    const result = exerciseFormSchema.safeParse({
      templateCode: 'word_bank_fill',
      wbfWordBank: 'show off, boast',
      wbfSentences: [{ text: 'No blank here.', answers: [''] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wbfSentences.0.text');
  });

  it('word_bank_fill: rejects a blank left without an answer', () => {
    const result = exerciseFormSchema.safeParse({
      templateCode: 'word_bank_fill',
      wbfWordBank: 'show off, boast',
      wbfSentences: [{ text: 'He ___1___ and she ___2___.', answers: ['boast'] }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wbfSentences.0.answers.1');
  });

  it('fill_in_blank: accepts a text with at least one blank', () => {
    expect(
      exerciseFormSchema.safeParse({
        templateCode: 'fill_in_blank',
        fibText: 'Jeg ___1___ norsk.',
        fibBlanks: [{ answers: 'snakker' }],
      }).success,
    ).toBe(true);
  });

  it('fill_in_blank: rejects when fibText is missing', () => {
    const result = exerciseFormSchema.safeParse({
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
      exerciseFormSchema.safeParse({
        templateCode: 'translate_to_target',
        trSourceText: 'I speak Norwegian',
        trAcceptedTranslations: [{ text: 'Jeg snakker norsk' }],
      }).success,
    ).toBe(true);
  });

  it('translate_from_target: rejects when no accepted translation provided', () => {
    const result = exerciseFormSchema.safeParse({
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
      exerciseFormSchema.safeParse({
        templateCode: 'match_pairs',
        mpPairs: [
          { left: 'hei', right: 'hello' },
          { left: 'takk', right: 'thanks' },
        ],
      }).success,
    ).toBe(true);
  });

  it('match_pairs: rejects fewer than 2 pairs', () => {
    const result = exerciseFormSchema.safeParse({
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
      exerciseFormSchema.safeParse({
        templateCode: 'short_answer',
        saQuestion: 'When did Anne hear the news?',
        saReferenceAnswer: 'On the radio.',
      }).success,
    ).toBe(true);
  });

  it('short_answer: rejects when the reference answer is missing', () => {
    const result = exerciseFormSchema.safeParse({
      templateCode: 'short_answer',
      saQuestion: 'Q?',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('saReferenceAnswer');
  });

  it('writing_task: accepts a prompt', () => {
    expect(
      exerciseFormSchema.safeParse({ templateCode: 'writing_task', wtPrompt: 'Write a letter.' })
        .success,
    ).toBe(true);
  });

  it('writing_task: rejects when the prompt is missing', () => {
    const result = exerciseFormSchema.safeParse({ templateCode: 'writing_task' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('wtPrompt');
  });

  it('sentence_schema: accepts a sentence with 2+ fields and assigned tokens', () => {
    expect(
      exerciseFormSchema.safeParse({
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
    const result = exerciseFormSchema.safeParse({
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
