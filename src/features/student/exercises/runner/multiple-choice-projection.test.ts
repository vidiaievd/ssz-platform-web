import { describe, expect, it } from 'vitest';

import { readMultipleChoiceProjection } from './multiple-choice-projection';

const projection = {
  instruction: 'Velg formen som passer.',
  questions: [
    {
      id: 'q1',
      kind: 'grammar',
      stem: 'Han sa at han ___ syk.',
      options: [
        { id: 'a', text: 'er' },
        { id: 'b', text: 'var' },
      ],
    },
  ],
  settings: {
    letters: true,
    layout: 'list',
    instant: false,
    retry: 'one',
    eliminate: false,
    progress: true,
  },
};

describe('readMultipleChoiceProjection', () => {
  it('reads a set the server projected', () => {
    const set = readMultipleChoiceProjection(projection);

    expect(set?.instruction).toBe('Velg formen som passer.');
    expect(set?.questions).toHaveLength(1);
    expect(set?.questions[0]?.options.map((o) => o.id)).toEqual(['a', 'b']);
    expect(set?.settings.retry).toBe('one');
  });

  // The refusals are the point of the file: every one of them means an engine older than
  // phase 2 of plan 53, or a route that reached for the authoring copy. Stripping the key
  // here would leave a runner that works and a retry that means nothing.
  it('refuses a document whose options say which one is correct', () => {
    const leaked = {
      ...projection,
      questions: [
        {
          ...projection.questions[0],
          options: [
            { id: 'a', text: 'er', correct: false },
            { id: 'b', text: 'var', correct: true },
          ],
        },
      ],
    };

    expect(readMultipleChoiceProjection(leaked)).toBeNull();
  });

  it('refuses a document carrying the rule behind the answer', () => {
    const leaked = {
      ...projection,
      questions: [{ ...projection.questions[0], why: 'Presens flyttes til preteritum.' }],
    };

    expect(readMultipleChoiceProjection(leaked)).toBeNull();
  });

  it('refuses a document carrying a rebuttal on an option', () => {
    const leaked = {
      ...projection,
      questions: [
        {
          ...projection.questions[0],
          options: [
            { id: 'a', text: 'er', why: '«er» er presens.' },
            { id: 'b', text: 'var' },
          ],
        },
      ],
    };

    expect(readMultipleChoiceProjection(leaked)).toBeNull();
  });

  it('refuses a document of the old single-question form', () => {
    // Not a deployment fault — 121 seeded exercises are still written this way, and the
    // reader sends them to the legacy runner before ever getting here.
    const old = {
      question: 'Han sa at han ___ syk.',
      options: [
        { id: 'a', text: 'er' },
        { id: 'b', text: 'var' },
      ],
    };

    expect(readMultipleChoiceProjection(old)).toBeNull();
  });

  it('refuses a question with fewer than two options', () => {
    // The projection drops unanswerable questions, so one arriving here means the two
    // sides disagree about what is deliverable.
    const thin = {
      ...projection,
      questions: [{ ...projection.questions[0], options: [{ id: 'a', text: 'er' }] }],
    };

    expect(readMultipleChoiceProjection(thin)).toBeNull();
  });

  it('keeps a passage the server chose to send, and defaults the kind', () => {
    const set = readMultipleChoiceProjection({
      ...projection,
      questions: [{ ...projection.questions[0], kind: 'nonsense', context: 'Bartek er elektriker.' }],
    });

    expect(set?.questions[0]?.kind).toBe('grammar');
    expect(set?.questions[0]?.context).toBe('Bartek er elektriker.');
  });

  it('falls back to the author defaults for settings that did not arrive', () => {
    const set = readMultipleChoiceProjection({ ...projection, settings: { retry: 'nonsense' } });

    expect(set?.settings.retry).toBe('one');
    expect(set?.settings.letters).toBe(true);
    expect(set?.settings.layout).toBe('list');
  });
});
