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
  mpVariant: 'pairs',
  mpPairs: [
    { left: '', right: '' },
    { left: '', right: '' },
  ],
  wbfWordBank: '',
  wbfSentences: [{ text: '', answers: [''] }],
  ecSentences: [{ chunks: '', fixes: [{ chunkIndex: '', accepted: '', note: '' }] }],
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
    const values = minimalMcqValues('Practice');
    const { content, expectedAnswers } = buildExercisePayload(values);
    expect(content.question).toBe('Practice');
    expect((content.options as unknown[]).length).toBe(2);
    expect(expectedAnswers.correct_option_ids).toEqual(['opt-0']);
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
    const parsed = parseExerciseToForm({ templateCode: 'sentence_schema', content, expectedAnswers });
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
    const parsed = parseExerciseToForm({ templateCode: 'word_bank_fill', content, expectedAnswers });

    expect(parsed.wbfWordBank).toBe('show off, boast, clicked with');
    expect(parsed.wbfSentences).toEqual([
      { text: 'I hate it when people ___1___ all the time.', answers: ['show off'] },
      { text: 'They ___1___ and we ___2___ anyway.', answers: ['boast', 'clicked with, clicked'] },
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

describe('match_pairs layout variant', () => {
  const pairs = [
    { left: 'Do you live …', right: '… near here?' },
    { left: 'How long have you …', right: '… lived here?' },
  ];

  it('stores the halves layout and round-trips it', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'match_pairs',
      mpVariant: 'halves',
      mpPairs: pairs,
    });

    expect(content.variant).toBe('halves');
    expect(parseExerciseToForm({ templateCode: 'match_pairs', content, expectedAnswers }).mpVariant).toBe(
      'halves',
    );
  });

  it('omits the key for the default word-pairs layout', () => {
    const { content, expectedAnswers } = buildExercisePayload({
      ...base,
      templateCode: 'match_pairs',
      mpVariant: 'pairs',
      mpPairs: pairs,
    });

    expect('variant' in content).toBe(false);
    expect(parseExerciseToForm({ templateCode: 'match_pairs', content, expectedAnswers }).mpVariant).toBe(
      'pairs',
    );
  });
});

describe('error_correction', () => {
  const values: ExerciseFormValues = {
    ...base,
    templateCode: 'error_correction',
    ecSentences: [
      {
        chunks: 'I could see | that the more | she was warming up with me',
        fixes: [{ chunkIndex: '3', accepted: 'she was warming to me, she warmed to me', note: 'warm to sb' }],
      },
      {
        chunks: 'They say | make your mind | about people',
        fixes: [{ chunkIndex: '2', accepted: 'make up your mind', note: '' }],
      },
    ],
  };

  it('splits chunks on | and points each fix at the numbered part', () => {
    const { content, expectedAnswers } = buildExercisePayload(values);

    expect(content.items).toEqual([
      {
        id: 's-0',
        chunks: [
          { id: 'c-0', text: 'I could see' },
          { id: 'c-1', text: 'that the more' },
          { id: 'c-2', text: 'she was warming up with me' },
        ],
      },
      {
        id: 's-1',
        chunks: [
          { id: 'c-0', text: 'They say' },
          { id: 'c-1', text: 'make your mind' },
          { id: 'c-2', text: 'about people' },
        ],
      },
    ]);
    // Authors count parts from 1; ids are 0-based.
    expect(expectedAnswers.corrections).toEqual([
      {
        item_id: 's-0',
        chunk_id: 'c-2',
        accepted: ['she was warming to me', 'she warmed to me'],
        note: 'warm to sb',
      },
      { item_id: 's-1', chunk_id: 'c-1', accepted: ['make up your mind'] },
    ]);
    expect(content.mistake_count).toBe(2);
  });

  it('round-trips through parseExerciseToForm', () => {
    const { content, expectedAnswers } = buildExercisePayload(values);
    const parsed = parseExerciseToForm({
      templateCode: 'error_correction',
      content,
      expectedAnswers,
    });

    expect(parsed.ecSentences).toEqual([
      {
        chunks: 'I could see | that the more | she was warming up with me',
        fixes: [
          { chunkIndex: '3', accepted: 'she was warming to me, she warmed to me', note: 'warm to sb' },
        ],
      },
      {
        chunks: 'They say | make your mind | about people',
        fixes: [{ chunkIndex: '2', accepted: 'make up your mind', note: '' }],
      },
    ]);
  });
});
