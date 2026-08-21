import { describe, expect, it } from 'vitest';

import {
  buildExercisePayload,
  parseExerciseToForm,
  minimalMcqValues,
  minimalExerciseValues,
} from './exercise-content';
import { EXERCISE_TYPES, exerciseFormSchema, type ExerciseFormValues } from '../schemas/exercise';

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
  wbfWordBank: '',
  wbfSentences: [{ text: '', answers: [''] }],
  toKind: 'dialogue',
  toLines: [
    { text: '', speaker: '' },
    { text: '', speaker: '' },
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

  it('fill_in_blank: omits rationale entirely when the author left it empty', () => {
    const { expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'fill_in_blank',
      fibText: 'Han sier ___1___ han er sliten.',
      fibBlanks: [{ answers: 'at', rationaleExplanation: '   ', rationaleOptions: [] }],
    });
    expect(expectedAnswers).toEqual({ blanks: [{ blank_id: 1, accepted_answers: ['at'] }] });
  });

  it('fill_in_blank: builds the rationale matrix and drops options with no text', () => {
    const { expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'fill_in_blank',
      fibText: 'Han sier ___1___ han er sliten.',
      fibBlanks: [
        {
          answers: 'at',
          rationaleExplanation: '  A statement is introduced by «at».  ',
          rationaleOptions: [
            { text: ' at ', verdict: 'correct', note: ' Statement → at. ' },
            { text: 'om', verdict: 'wrong', note: '' },
            { text: '   ', verdict: 'acceptable', note: 'dropped — no option text' },
          ],
        },
      ],
    });
    expect(expectedAnswers).toEqual({
      blanks: [
        {
          blank_id: 1,
          accepted_answers: ['at'],
          rationale: {
            explanation: 'A statement is introduced by «at».',
            options: [
              { text: 'at', verdict: 'correct', note: 'Statement → at.' },
              { text: 'om', verdict: 'wrong' },
            ],
          },
        },
      ],
    });
  });

  it('fill_in_blank: round-trips a rationale back into the form model', () => {
    const parsed = parseExerciseToForm({
      id: 'x',
      templateCode: 'fill_in_blank',
      content: { text_with_blanks: 'Han sier ___1___ han er sliten.' },
      expectedAnswers: {
        blanks: [
          {
            blank_id: 1,
            accepted_answers: ['at'],
            rationale: {
              explanation: 'A statement is introduced by «at».',
              options: [
                { text: 'at', verdict: 'correct', note: 'Statement → at.' },
                { text: 'om', verdict: 'wrong' },
              ],
            },
          },
        ],
      },
    } as Parameters<typeof parseExerciseToForm>[0]);

    expect(parsed.fibBlanks).toEqual([
      {
        answers: 'at',
        rationaleExplanation: 'A statement is introduced by «at».',
        rationaleOptions: [
          { text: 'at', verdict: 'correct', note: 'Statement → at.' },
          { text: 'om', verdict: 'wrong', note: '' },
        ],
      },
    ]);
  });

  it('fill_in_blank: falls back to a safe verdict when the stored value is unknown', () => {
    const parsed = parseExerciseToForm({
      id: 'x',
      templateCode: 'fill_in_blank',
      content: { text_with_blanks: 'Han sier ___1___ han er sliten.' },
      expectedAnswers: {
        blanks: [
          {
            blank_id: 1,
            accepted_answers: ['at'],
            rationale: { options: [{ text: 'om', verdict: 'bogus' }] },
          },
        ],
      },
    } as Parameters<typeof parseExerciseToForm>[0]);

    expect(parsed.fibBlanks?.[0]?.rationaleOptions?.[0]?.verdict).toBe('wrong');
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
  ];

  for (const { name, values } of cases) {
    it(`${name} survives a build → parse round-trip`, () => {
      const { content, expectedAnswers } = buildExercisePayload(values);
      const parsed = parseExerciseToForm({
        templateCode: values.templateCode,
        content,
        expectedAnswers,
      });
      const rebuilt = buildExercisePayload(parsed);
      expect(rebuilt.content).toEqual(content);
      expect(rebuilt.expectedAnswers).toEqual(expectedAnswers);
    });
  }
});

describe('merging over the stored exercise', () => {
  // Shaped after the seeded word_bank_fill exercises. `input_mode` and
  // `reusable_words` have no field in the form, so a rebuild-from-scratch would
  // drop them on save; the rest the form now models and round-trips.
  const stored = {
    content: {
      word_bank: ['show off', 'boast'],
      input_mode: 'select',
      reusable_words: true,
      word_notes: { 'show off': 'skryte' },
      items: [
        { id: '1', text_with_blanks: 'People ___1___ all the time.' },
        { id: '2', text_with_blanks: 'They ___1___ anyway.' },
      ],
    },
    expectedAnswers: {
      items: [
        {
          id: '1',
          blanks: [
            {
              blank_id: 1,
              accepted_answers: ['show off'],
              rationale: { explanation: 'phrasal verb, no object' },
            },
          ],
        },
        { id: '2', blanks: [{ blank_id: 1, accepted_answers: ['boast'] }] },
      ],
    },
  };

  const reopened = (): ExerciseFormValues =>
    parseExerciseToForm({ templateCode: 'word_bank_fill', ...stored });

  it('keeps the keys the form does not model through open → save', () => {
    const saved = buildExercisePayload(reopened(), stored);

    expect(saved.content).toEqual(stored.content);
    expect(saved.expectedAnswers).toEqual(stored.expectedAnswers);
  });

  it('still applies the edit the author made', () => {
    const values = reopened();
    const saved = buildExercisePayload(
      {
        ...values,
        wbfSentences: [
          { ...values.wbfSentences![0]!, answers: ['show off, showing off'] },
          values.wbfSentences![1]!,
        ],
      },
      stored,
    );

    expect(saved.expectedAnswers).toEqual({
      items: [
        {
          id: '1',
          blanks: [
            {
              blank_id: 1,
              accepted_answers: ['show off', 'showing off'],
              rationale: { explanation: 'phrasal verb, no object' },
            },
          ],
        },
        { id: '2', blanks: [{ blank_id: 1, accepted_answers: ['boast'] }] },
      ],
    });
  });

  it('drops the stored entry for a question the author deleted', () => {
    const values = reopened();
    const saved = buildExercisePayload(
      { ...values, wbfSentences: [values.wbfSentences![0]!] },
      stored,
    );

    expect(saved.content.items).toHaveLength(1);
    expect(saved.expectedAnswers.items).toHaveLength(1);
  });

  it('clears a field the form does model', () => {
    const withContext = { content: { question: 'Hva?', options: [], context: 'gammel' } };
    const values = parseExerciseToForm({ templateCode: 'multiple_choice', ...withContext });
    const saved = buildExercisePayload({ ...values, mcContext: '' }, withContext);

    expect(saved.content).not.toHaveProperty('context');
  });

  it('leaves the payload untouched when there is nothing stored yet', () => {
    expect(buildExercisePayload(reopened())).toEqual(
      buildExercisePayload(reopened(), { content: {}, expectedAnswers: {} }),
    );
  });
});

describe('parseExerciseToForm', () => {
  it('falls back to multiple_choice for an unknown template code', () => {
    const parsed = parseExerciseToForm({ templateCode: 'mystery', content: {} });
    expect(parsed.templateCode).toBe('multiple_choice');
  });

  it('maps the first instruction entry to the instructions/hint fields', () => {
    const parsed = parseExerciseToForm({
      templateCode: 'multiple_choice',
      content: { question: 'Q', options: [{ id: 'opt-0', text: 'a' }] },
      instructions: [
        {
          id: 'i1',
          exerciseId: 'e1',
          instructionLanguage: 'en',
          instructionText: 'Pick one.',
          hintText: 'Look at context.',
        },
      ],
    });
    expect(parsed.instructions).toBe('Pick one.');
    expect(parsed.hint).toBe('Look at context.');
  });

  it('defaults instructions/hint to empty when none are present', () => {
    const parsed = parseExerciseToForm({ templateCode: 'multiple_choice', content: {} });
    expect(parsed.instructions).toBe('');
    expect(parsed.hint).toBe('');
  });
});

describe('minimalMcqValues', () => {
  it('produces a valid two-option MCQ with the given question', () => {
    const values = minimalMcqValues('Practice', 'Choose the correct answer.');
    const { content, expectedAnswers } = buildExercisePayload(values);
    expect(content.question).toBe('Practice');
    expect((content.options as unknown[]).length).toBe(2);
    expect(expectedAnswers.correct_option_ids).toEqual(['opt-0']);
  });
});

describe('minimalExerciseValues', () => {
  // The picker creates the exercise before the author types anything, and
  // `createExerciseAction` runs the form schema over it — a template whose
  // scaffold does not validate is a template nobody can add to a course.
  for (const code of EXERCISE_TYPES) {
    it(`${code}: scaffolds a draft the form schema accepts`, () => {
      const result = exerciseFormSchema.safeParse(
        minimalExerciseValues(code, 'New exercise', 'Complete the exercise.'),
      );
      if (!result.success) {
        throw new Error(
          `${code}: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`,
        );
      }
      expect(result.data.templateCode).toBe(code);
    });
  }

  it('every scaffold carries an instruction', () => {
    // The picker creates the exercise without ever showing the form, and an
    // exercise with no instruction row is a publish blocker.
    for (const code of EXERCISE_TYPES) {
      expect(
        minimalExerciseValues(code, 'New exercise', 'Complete the exercise.').instructions,
        code,
      ).toBe('Complete the exercise.');
    }
  });

  it('every scaffold builds a payload with a non-empty content object', () => {
    for (const code of EXERCISE_TYPES) {
      const { content } = buildExercisePayload(
        minimalExerciseValues(code, 'New exercise', 'Complete the exercise.'),
      );
      expect(Object.keys(content).length, code).toBeGreaterThan(0);
    }
  });
});

describe('short_answer & writing_task', () => {
  it('short_answer: builds question + reference + pipe-separated accepted_answers', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'short_answer',
      saQuestion: 'Når hørte Anne nyheten?',
      saContext: 'Tekst 19A',
      saReferenceAnswer: 'Hun hørte det på radio.',
      saAccepted: 'på radio | på veien hjem',
    });
    expect(content.question).toBe('Når hørte Anne nyheten?');
    expect(content.context).toBe('Tekst 19A');
    expect(expectedAnswers.reference_answer).toBe('Hun hørte det på radio.');
    expect(expectedAnswers.accepted_answers).toEqual(['på radio', 'på veien hjem']);
  });

  it('short_answer: omits context and accepted_answers when empty', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'short_answer',
      saQuestion: 'Q?',
      saReferenceAnswer: 'A.',
    });
    expect('context' in content).toBe(false);
    expect('accepted_answers' in expectedAnswers).toBe(false);
  });

  it('short_answer: round-trips through parse', () => {
    const values = {
      ...base,
      templateCode: 'short_answer' as const,
      saQuestion: 'Q?',
      saReferenceAnswer: 'A.',
      saAccepted: 'a | b',
    };
    const { content, expectedAnswers } = buildExercisePayload(values);
    const parsed = parseExerciseToForm({ templateCode: 'short_answer', content, expectedAnswers });
    expect(parsed.saQuestion).toBe('Q?');
    expect(parsed.saReferenceAnswer).toBe('A.');
    expect(parsed.saAccepted).toBe('a | b');
  });

  it('short_answer: keeps a comma inside an accepted answer intact', () => {
    // Transformation answers carry commas ("Hadde jeg tid, ville jeg hjulpet").
    // Splitting on them used to file half a sentence as an answer of its own,
    // which the word-by-word checker would then mark a fragment correct.
    const values = {
      ...base,
      templateCode: 'short_answer' as const,
      saQuestion: 'Slå sammen til én setning.',
      saReferenceAnswer: 'Avisa (som) jeg leser, er seriøs.',
      saAccepted: 'avisa som jeg leser, er seriøs | avisa jeg leser, er seriøs',
    };
    const { content, expectedAnswers } = buildExercisePayload(values);
    expect(expectedAnswers.accepted_answers).toEqual([
      'avisa som jeg leser, er seriøs',
      'avisa jeg leser, er seriøs',
    ]);

    const parsed = parseExerciseToForm({ templateCode: 'short_answer', content, expectedAnswers });
    expect(parsed.saAccepted).toBe('avisa som jeg leser, er seriøs | avisa jeg leser, er seriøs');
  });

  it('writing_task: builds prompt + topic options with ids + min_words', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'writing_task',
      wtPrompt: 'Skriv et leserinnlegg.',
      wtMinWords: '60',
      wtTopics: [{ title: 'Gratis norskkurs' }, { title: '' }, { title: 'Tog billigere' }],
      wtRubric: 'Struktur, argument',
    });
    expect(content.prompt).toBe('Skriv et leserinnlegg.');
    expect(content.min_words).toBe(60);
    expect(content.options).toEqual([
      { id: 'topic-0', title: 'Gratis norskkurs' },
      { id: 'topic-1', title: 'Tog billigere' },
    ]);
    expect(expectedAnswers.rubric).toBe('Struktur, argument');
  });

  it('writing_task: omits options/min_words/rubric when empty', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'writing_task',
      wtPrompt: 'Skriv.',
    });
    expect('options' in content).toBe(false);
    expect('min_words' in content).toBe(false);
    expect('rubric' in expectedAnswers).toBe(false);
  });
});

describe('sentence_schema', () => {
  it('builds fields/tokens with ids and ordered per-field placements', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'sentence_schema',
      ssSentence: 'Lars har aldri likt Lotte.',
      ssSchemaType: 'main',
      ssFields: [{ label: 'Forfelt' }, { label: 'Verbal' }, { label: 'Sluttfelt' }],
      ssTokens: [
        { text: 'Lars', fieldIndex: 0 },
        { text: 'har', fieldIndex: 1 },
        { text: 'Lotte', fieldIndex: 2 },
      ],
    });
    expect(content.sentence).toBe('Lars har aldri likt Lotte.');
    expect(content.schema_type).toBe('main');
    expect(content.fields).toEqual([
      { id: 'f-0', label: 'Forfelt' },
      { id: 'f-1', label: 'Verbal' },
      { id: 'f-2', label: 'Sluttfelt' },
    ]);
    expect(content.tokens).toEqual([
      { id: 't-0', text: 'Lars' },
      { id: 't-1', text: 'har' },
      { id: 't-2', text: 'Lotte' },
    ]);
    expect(expectedAnswers.placements).toEqual([
      { field_id: 'f-0', token_ids: ['t-0'] },
      { field_id: 'f-1', token_ids: ['t-1'] },
      { field_id: 'f-2', token_ids: ['t-2'] },
    ]);
  });

  it('keeps token order within a field', () => {
    const { expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'sentence_schema',
      ssSentence: 'S',
      ssFields: [{ label: 'A' }, { label: 'B' }],
      ssTokens: [
        { text: 'x', fieldIndex: 1 },
        { text: 'y', fieldIndex: 0 },
        { text: 'z', fieldIndex: 1 },
      ],
    });
    expect(expectedAnswers.placements).toEqual([
      { field_id: 'f-0', token_ids: ['t-1'] },
      { field_id: 'f-1', token_ids: ['t-0', 't-2'] },
    ]);
  });

  it('drops empty fields and remaps token assignments by original index', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'sentence_schema',
      ssSentence: 'S',
      // index 1 is empty and should be dropped; token assigned to index 2 must
      // follow the surviving field.
      ssFields: [{ label: 'A' }, { label: '' }, { label: 'C' }],
      ssTokens: [
        { text: 'a', fieldIndex: 0 },
        { text: 'c', fieldIndex: 2 },
      ],
    });
    expect(content.fields).toEqual([
      { id: 'f-0', label: 'A' },
      { id: 'f-1', label: 'C' },
    ]);
    expect(expectedAnswers.placements).toEqual([
      { field_id: 'f-0', token_ids: ['t-0'] },
      { field_id: 'f-1', token_ids: ['t-1'] },
    ]);
  });

  it('round-trips through parse (field index reconstructed from placements)', () => {
    const values = {
      ...base,
      templateCode: 'sentence_schema' as const,
      ssSentence: 'Lars har likt Lotte',
      ssSchemaType: 'subordinate' as const,
      ssFields: [{ label: 'A' }, { label: 'B' }],
      ssTokens: [
        { text: 'Lars', fieldIndex: 0 },
        { text: 'har', fieldIndex: 1 },
      ],
    };
    const { content, expectedAnswers } = buildExercisePayload(values);
    const parsed = parseExerciseToForm({
      templateCode: 'sentence_schema',
      content,
      expectedAnswers,
    });
    expect(parsed.ssSentence).toBe('Lars har likt Lotte');
    expect(parsed.ssSchemaType).toBe('subordinate');
    expect(parsed.ssFields).toEqual([{ label: 'A' }, { label: 'B' }]);
    expect(parsed.ssTokens).toEqual([
      { text: 'Lars', fieldIndex: 0 },
      { text: 'har', fieldIndex: 1 },
    ]);
  });
});

describe('word_bank_fill', () => {
  const values: ExerciseFormValues = {
    ...base,
    templateCode: 'word_bank_fill',
    wbfWordBank: 'show off, boast, clicked with',
    wbfSentences: [
      { text: 'I hate it when people ___1___ all the time.', answers: ['show off'] },
      { text: 'They ___1___ and we ___2___ anyway.', answers: ['boast', 'clicked with, clicked'] },
      { text: '   ', answers: [''] },
    ],
  };

  it('builds the shared bank and one answer entry per marker', () => {
    const { content, expectedAnswers } = buildExercisePayload(values);

    expect(content).toEqual({
      word_bank: ['show off', 'boast', 'clicked with'],
      items: [
        { id: '1', text_with_blanks: 'I hate it when people ___1___ all the time.' },
        { id: '2', text_with_blanks: 'They ___1___ and we ___2___ anyway.' },
      ],
    });
    expect(expectedAnswers).toEqual({
      items: [
        { id: '1', blanks: [{ blank_id: 1, accepted_answers: ['show off'] }] },
        {
          id: '2',
          blanks: [
            { blank_id: 1, accepted_answers: ['boast'] },
            { blank_id: 2, accepted_answers: ['clicked with', 'clicked'] },
          ],
        },
      ],
    });
  });

  it('takes blank ids from the markers, not from input order', () => {
    const { expectedAnswers } = buildExercisePayload({
      ...values,
      wbfSentences: [{ text: 'Only ___2___ here.', answers: ['boast'] }],
    });

    expect(expectedAnswers).toEqual({
      items: [{ id: '1', blanks: [{ blank_id: 2, accepted_answers: ['boast'] }] }],
    });
  });

  it('round-trips through parseExerciseToForm', () => {
    const { content, expectedAnswers } = buildExercisePayload(values);
    const parsed = parseExerciseToForm({
      templateCode: 'word_bank_fill',
      content,
      expectedAnswers,
    });

    expect(parsed.wbfWordBank).toBe('show off, boast, clicked with');
    expect(parsed.wbfSentences).toEqual([
      {
        text: 'I hate it when people ___1___ all the time.',
        answers: ['show off'],
        rationales: [{ explanation: '', options: [] }],
      },
      {
        text: 'They ___1___ and we ___2___ anyway.',
        answers: ['boast', 'clicked with, clicked'],
        rationales: [
          { explanation: '', options: [] },
          { explanation: '', options: [] },
        ],
      },
    ]);
  });

  it('carries a per-blank rationale matrix, indexed like the answers', () => {
    const { expectedAnswers } = buildExercisePayload({
      ...values,
      wbfSentences: [
        {
          text: 'They ___1___ and we ___2___ anyway.',
          answers: ['boast', 'clicked with'],
          rationales: [
            {
              explanation: 'skryte — å snakke stort om seg selv',
              options: [
                { text: 'boast', verdict: 'correct', note: 'the neutral verb' },
                { text: 'show off', verdict: 'acceptable', note: 'more about behaviour' },
              ],
            },
            // Second blank deliberately left without one: a sentence may explain
            // some of its blanks and not others.
            {},
          ],
        },
      ],
    });

    expect(expectedAnswers).toEqual({
      items: [
        {
          id: '1',
          blanks: [
            {
              blank_id: 1,
              accepted_answers: ['boast'],
              rationale: {
                explanation: 'skryte — å snakke stort om seg selv',
                options: [
                  { text: 'boast', verdict: 'correct', note: 'the neutral verb' },
                  { text: 'show off', verdict: 'acceptable', note: 'more about behaviour' },
                ],
              },
            },
            { blank_id: 2, accepted_answers: ['clicked with'] },
          ],
        },
      ],
    });
  });

  it('round-trips the rationale matrix', () => {
    const authored: ExerciseFormValues = {
      ...values,
      wbfSentences: [
        {
          text: 'They ___1___ anyway.',
          answers: ['boast'],
          rationales: [
            {
              explanation: 'why boast',
              options: [{ text: 'show off', verdict: 'wrong', note: 'too colloquial' }],
            },
          ],
        },
      ],
    };
    const { content, expectedAnswers } = buildExercisePayload(authored);
    const parsed = parseExerciseToForm({
      templateCode: 'word_bank_fill',
      content,
      expectedAnswers,
    });

    expect(parsed.wbfSentences?.[0]?.rationales).toEqual([
      {
        explanation: 'why boast',
        options: [{ text: 'show off', verdict: 'wrong', note: 'too colloquial' }],
      },
    ]);
    expect(buildExercisePayload(parsed).expectedAnswers).toEqual(expectedAnswers);
  });

  it('keeps word notes as an object keyed by the bank word', () => {
    const { content } = buildExercisePayload({
      ...values,
      wbfWordNotes: [
        { word: 'boast', note: 'skryte' },
        { word: 'show off', note: 'vise seg fram' },
        // Half-filled rows are dropped rather than stored as empty strings.
        { word: 'clicked with', note: '  ' },
        { word: '', note: 'orphan' },
      ],
    });

    expect(content.word_notes).toEqual({ boast: 'skryte', 'show off': 'vise seg fram' });
  });

  it('round-trips word notes back into editable rows', () => {
    const parsed = parseExerciseToForm({
      templateCode: 'word_bank_fill',
      content: {
        word_bank: ['at', 'om'],
        items: [{ id: '1', text_with_blanks: 'Han sier ___1___ han er sliten.' }],
        word_notes: { at: 'utterance', om: 'yes/no question' },
      },
      expectedAnswers: {
        items: [{ id: '1', blanks: [{ blank_id: 1, accepted_answers: ['at'] }] }],
      },
    });

    expect(parsed.wbfWordNotes).toEqual([
      { word: 'at', note: 'utterance' },
      { word: 'om', note: 'yes/no question' },
    ]);
  });
});

describe('text_order', () => {
  const values: ExerciseFormValues = {
    ...base,
    templateCode: 'text_order',
    toKind: 'dialogue',
    toLines: [
      { text: 'Hi, I am Marina.', speaker: 'Marina' },
      { text: 'Nice to meet you.', speaker: 'Alex' },
      { text: '   ', speaker: '' },
    ],
  };

  it('builds items in the authored order and answers the same sequence', () => {
    const { content, expectedAnswers } = buildExercisePayload(values);

    expect(content).toEqual({
      kind: 'dialogue',
      items: [
        { id: 'line-0', text: 'Hi, I am Marina.', speaker: 'Marina' },
        { id: 'line-1', text: 'Nice to meet you.', speaker: 'Alex' },
      ],
    });
    expect(expectedAnswers).toEqual({ order: ['line-0', 'line-1'] });
  });

  it('omits an empty speaker instead of storing a blank one', () => {
    const { content } = buildExercisePayload({
      ...values,
      toKind: 'sentences',
      toLines: [
        { text: 'First.', speaker: '' },
        { text: 'Second.', speaker: '' },
      ],
    });

    expect(content.items).toEqual([
      { id: 'line-0', text: 'First.' },
      { id: 'line-1', text: 'Second.' },
    ]);
  });

  it('restores the authored order from expectedAnswers, not from content order', () => {
    const parsed = parseExerciseToForm({
      templateCode: 'text_order',
      content: {
        kind: 'dialogue',
        items: [
          { id: 'line-1', text: 'Nice to meet you.', speaker: 'Alex' },
          { id: 'line-0', text: 'Hi, I am Marina.', speaker: 'Marina' },
        ],
      },
      expectedAnswers: { order: ['line-0', 'line-1'] },
    });

    expect(parsed.toLines).toEqual([
      { text: 'Hi, I am Marina.', speaker: 'Marina' },
      { text: 'Nice to meet you.', speaker: 'Alex' },
    ]);
  });
});

describe('multiple_choice_group', () => {
  // A Riktig / Galt table: every statement answers from the same column.
  const trueFalse: ExerciseFormValues = {
    ...base,
    templateCode: 'multiple_choice_group',
    mcgContext: 'Tekst 1A — Bartek søker ny jobb.',
    mcgSharedOptions: [{ text: 'Riktig' }, { text: 'Galt' }],
    mcgItems: [
      { question: 'Annonsen ber om fagbrev.', options: [], correctIndex: 0, explanation: '' },
      {
        question: 'Firmaet vil ha fem års erfaring.',
        options: [],
        correctIndex: 1,
        explanation: 'Annonsen ber om minst tre år.',
      },
    ],
  };

  it('shares one option column across every question', () => {
    const { content, expectedAnswers } = buildExercisePayload(trueFalse);

    expect(content).toEqual({
      options: [
        { id: 'opt-0', text: 'Riktig' },
        { id: 'opt-1', text: 'Galt' },
      ],
      items: [
        { id: '1', question: 'Annonsen ber om fagbrev.' },
        { id: '2', question: 'Firmaet vil ha fem års erfaring.' },
      ],
      context: 'Tekst 1A — Bartek søker ny jobb.',
    });
    expect(expectedAnswers).toEqual({
      items: [
        { id: '1', correct_option_ids: ['opt-0'] },
        { id: '2', correct_option_ids: ['opt-1'], explanation: 'Annonsen ber om minst tre år.' },
      ],
    });
  });

  it('lets a question carry options of its own', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'multiple_choice_group',
      mcgSharedOptions: [{ text: '' }, { text: '' }],
      mcgItems: [
        {
          question: 'selvstendig',
          options: [{ text: 'som trenger mye hjelp' }, { text: 'som kan jobbe alene' }],
          correctIndex: 1,
          explanation: '',
        },
      ],
    });

    // No shared column was authored, so `options` stays off the block itself.
    expect(content).toEqual({
      items: [
        {
          id: '1',
          question: 'selvstendig',
          options: [
            { id: 'opt-0', text: 'som trenger mye hjelp' },
            { id: 'opt-1', text: 'som kan jobbe alene' },
          ],
        },
      ],
    });
    expect(expectedAnswers).toEqual({ items: [{ id: '1', correct_option_ids: ['opt-1'] }] });
  });

  it('drops questions with no text and renumbers the rest', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...trueFalse,
      mcgItems: [
        { question: '', options: [], correctIndex: 0, explanation: '' },
        { question: 'Anne leser søknaden.', options: [], correctIndex: 0, explanation: '' },
      ],
    });

    expect(content.items).toEqual([{ id: '1', question: 'Anne leser søknaden.' }]);
    expect(expectedAnswers).toEqual({ items: [{ id: '1', correct_option_ids: ['opt-0'] }] });
  });

  it('round-trips a mixed block through parseExerciseToForm', () => {
    const values: ExerciseFormValues = {
      ...trueFalse,
      mcgItems: [
        ...(trueFalse.mcgItems ?? []),
        {
          question: 'et fagbrev',
          options: [{ text: 'et vanlig brev' }, { text: 'et bevis på fagutdanning' }],
          correctIndex: 1,
          explanation: '',
        },
      ],
    };
    const { content, expectedAnswers } = buildExercisePayload(values);
    const parsed = parseExerciseToForm({
      templateCode: 'multiple_choice_group',
      content,
      expectedAnswers,
    });

    expect(parsed.mcgContext).toBe('Tekst 1A — Bartek søker ny jobb.');
    expect(parsed.mcgSharedOptions).toEqual([{ text: 'Riktig' }, { text: 'Galt' }]);
    expect(parsed.mcgItems).toEqual(values.mcgItems);

    const rebuilt = buildExercisePayload(parsed);
    expect(rebuilt.content).toEqual(content);
    expect(rebuilt.expectedAnswers).toEqual(expectedAnswers);
  });
});
