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
    type: 'COURSE' as const,
    targetLanguage: 'nb',
    accessTier: 'PUBLIC' as const,
  };

  it('accepts minimal valid data', () => {
    expect(containerFormSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const full = {
      ...valid,
      description: 'An intro course.',
      instructionLanguage: 'en',
      level: 'A1' as const,
      slug: 'norwegian-a1',
    };
    expect(containerFormSchema.safeParse(full).success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(containerFormSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rejects an invalid type', () => {
    expect(containerFormSchema.safeParse({ ...valid, type: 'LESSON' }).success).toBe(false);
  });

  it('rejects an invalid accessTier', () => {
    expect(containerFormSchema.safeParse({ ...valid, accessTier: 'PREMIUM' }).success).toBe(false);
  });

  it('rejects a slug with uppercase letters', () => {
    expect(containerFormSchema.safeParse({ ...valid, slug: 'Norwegian-A1' }).success).toBe(false);
  });

  it('rejects a slug with spaces', () => {
    expect(containerFormSchema.safeParse({ ...valid, slug: 'norwegian a1' }).success).toBe(false);
  });

  it('rejects a slug with a trailing hyphen', () => {
    expect(containerFormSchema.safeParse({ ...valid, slug: 'norwegian-a1-' }).success).toBe(false);
  });

  it('accepts a slug with numbers', () => {
    expect(containerFormSchema.safeParse({ ...valid, slug: 'course-2025' }).success).toBe(true);
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
