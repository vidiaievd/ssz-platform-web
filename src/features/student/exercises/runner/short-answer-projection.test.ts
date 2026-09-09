import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '@/lib/shared-kernel/short-answer';

import { readShortAnswerProjection } from './short-answer-projection';

/** What the server actually sends: questions without the key, settings without `typos`. */
const PROJECTION = {
  instruction: 'Svar med egne ord, én til tre setninger.',
  questions: [
    {
      id: 'sa1',
      kind: 'reading',
      prompt: 'Hvor lenge har Bartek jobbet i det samme firmaet?',
      passage: 'Bartek har jobbet som elektriker i det samme firmaet i tre år.',
    },
    { id: 'sa2', kind: 'opinion', prompt: 'Hva ville du gjort?' },
  ],
  settings: { ...DEFAULT_SETTINGS, typos: undefined, caseless: undefined },
};

describe('readShortAnswerProjection', () => {
  it('reads the set the server projected', () => {
    const set = readShortAnswerProjection(PROJECTION);

    expect(set?.instruction).toBe('Svar med egne ord, én til tre setninger.');
    expect(set?.questions.map((q) => q.id)).toEqual(['sa1', 'sa2']);
    expect(set?.questions[0]?.passage).toBe(
      'Bartek har jobbet som elektriker i det samme firmaet i tre år.',
    );
    expect(set?.questions[1]?.passage).toBeUndefined();
    expect(set?.settings.teacherReview).toBe('flagged');
  });

  it('refuses a question carrying the answer key rather than stripping it', () => {
    const withKey = {
      ...PROJECTION,
      questions: [
        {
          ...PROJECTION.questions[0],
          elements: [{ id: 'e1', label: 'Tre år', anchors: ['tre år'], required: true }],
        },
      ],
    };

    // Stripping here would leave a runner that works, an exercise that is pointless and
    // nothing on any screen to say the anchors were ever sent to a browser.
    expect(readShortAnswerProjection(withKey)).toBeNull();
  });

  it("refuses the author's explanation, which belongs under a verdict", () => {
    const withWhy = {
      ...PROJECTION,
      questions: [{ ...PROJECTION.questions[0], why: 'Svaret står i første setning.' }],
    };

    expect(readShortAnswerProjection(withWhy)).toBeNull();
  });

  it('refuses a model answer that arrives before showModel allows it', () => {
    const early = {
      ...PROJECTION,
      questions: [{ ...PROJECTION.questions[0], model: 'I tre år.' }],
      settings: { ...PROJECTION.settings, showModel: 'onClose' },
    };

    expect(readShortAnswerProjection(early)).toBeNull();
  });

  it("keeps the model answer under showModel: 'always' — the one case it is earned early", () => {
    const selfStudy = {
      ...PROJECTION,
      questions: [{ ...PROJECTION.questions[0], model: 'I tre år.' }],
      settings: { ...PROJECTION.settings, showModel: 'always' },
    };

    expect(readShortAnswerProjection(selfStudy)?.questions[0]?.model).toBe('I tre år.');
  });

  it('refuses a document of the old single-question form', () => {
    expect(readShortAnswerProjection({ question: 'Hvorfor?', context: 'Tekst 3A.' })).toBeNull();
  });

  it('refuses a question with no prompt — the server projection already drops those', () => {
    const blank = {
      ...PROJECTION,
      questions: [{ id: 'sa9', kind: 'reading', prompt: '   ' }],
    };

    expect(readShortAnswerProjection(blank)).toBeNull();
  });

  it("falls back to the author's own defaults for settings that did not arrive", () => {
    const bare = { instruction: '', questions: [PROJECTION.questions[0]], settings: {} };
    const set = readShortAnswerProjection(bare);

    expect(set?.settings.showModel).toBe(DEFAULT_SETTINGS.showModel);
    expect(set?.settings.minWords).toBe(DEFAULT_SETTINGS.minWords);
    expect(set?.settings.progress).toBe(DEFAULT_SETTINGS.progress);
  });
});
