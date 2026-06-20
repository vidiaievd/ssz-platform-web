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
  it('cloze: accepts valid data with a template', () => {
    expect(
      exerciseFormSchema.safeParse({
        templateCode: 'cloze',
        clozeTemplate: 'Jeg ___ norsk.',
        clozeAnswers: [{ text: 'snakker' }],
      }).success,
    ).toBe(true);
  });

  it('cloze: rejects when clozeTemplate is missing', () => {
    const result = exerciseFormSchema.safeParse({ templateCode: 'cloze' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('clozeTemplate');
  });

  it('cloze: rejects when clozeTemplate is blank', () => {
    const result = exerciseFormSchema.safeParse({ templateCode: 'cloze', clozeTemplate: '   ' });
    expect(result.success).toBe(false);
  });

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

  it('free_text: accepts valid data with a prompt', () => {
    expect(
      exerciseFormSchema.safeParse({
        templateCode: 'free_text',
        ftPrompt: 'Describe your day in Norwegian.',
      }).success,
    ).toBe(true);
  });

  it('free_text: rejects when ftPrompt is missing', () => {
    const result = exerciseFormSchema.safeParse({ templateCode: 'free_text' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('ftPrompt');
  });

  it('pronunciation: accepts valid data with pronText', () => {
    expect(
      exerciseFormSchema.safeParse({ templateCode: 'pronunciation', pronText: 'takk' }).success,
    ).toBe(true);
  });

  it('pronunciation: rejects when pronText is missing', () => {
    const result = exerciseFormSchema.safeParse({ templateCode: 'pronunciation' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('pronText');
  });
});
