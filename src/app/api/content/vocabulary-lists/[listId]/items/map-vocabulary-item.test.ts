// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { toFeShape, type BackendItemFull } from './map-vocabulary-item';

function backendItem(
  grammaticalProperties: Record<string, unknown> | null,
  overrides: Partial<BackendItemFull> = {},
): BackendItemFull {
  return {
    id: 'item-1',
    word: 'stillingsannonse',
    partOfSpeech: 'noun',
    ipaTranscription: null,
    grammaticalProperties,
    translations: [],
    usageExamples: [],
    ...overrides,
  };
}

describe('toFeShape — grammatical forms', () => {
  it('reads the flat inflection keys the course seeds write', () => {
    const item = toFeShape(
      backendItem({
        gender: 'masculine',
        definite_singular: 'stillingsannonsen',
        plural_form: 'stillingsannonser',
        definite_plural: 'stillingsannonsene',
      }),
    );

    expect(item.forms).toEqual([
      { label: 'Bestemt entall', value: 'stillingsannonsen' },
      { label: 'Ubestemt flertall', value: 'stillingsannonser' },
      { label: 'Bestemt flertall', value: 'stillingsannonsene' },
    ]);
  });

  it('orders verb tenses present → past → perfect regardless of key order', () => {
    const item = toFeShape(
      backendItem({ perfect_tense: 'søkt', past_tense: 'søkte', present_tense: 'søker' }),
    );

    expect(item.forms?.map((f) => f.value)).toEqual(['søker', 'søkte', 'søkt']);
    expect(item.forms?.map((f) => f.label)).toEqual(['Presens', 'Preteritum', 'Perfektum']);
  });

  it('reads adjective forms', () => {
    const item = toFeShape(backendItem({ neuter_form: 'erfarent', plural_form: 'erfarne' }));
    expect(item.forms).toEqual([
      { label: 'Intetkjønn', value: 'erfarent' },
      { label: 'Ubestemt flertall', value: 'erfarne' },
    ]);
  });

  it('still reads the documented authoring shape and prefers it', () => {
    const item = toFeShape(
      backendItem({
        forms: [['Bestemt entall', 'sykepleieren']],
        plural_form: 'ignored-when-explicit-forms-exist',
      }),
    );
    expect(item.forms).toEqual([{ label: 'Bestemt entall', value: 'sykepleieren' }]);
  });

  it('ignores metadata keys that are not surface forms', () => {
    expect(toFeShape(backendItem({ gender: 'neuter', verb_class: 'a-verb' })).forms).toBeUndefined();
  });

  it('ignores blank and non-string values', () => {
    expect(toFeShape(backendItem({ plural_form: '  ', definite_singular: 42 })).forms).toBeUndefined();
  });

  it('omits forms when there are no grammatical properties at all', () => {
    expect(toFeShape(backendItem(null)).forms).toBeUndefined();
  });
});

describe('toFeShape — paradigm grid', () => {
  it('lays a noun out as four cells, keeping the gender the flat list drops', () => {
    const item = toFeShape(
      backendItem({
        gender: 'masculine',
        definite_singular: 'stillingsannonsen',
        plural_form: 'stillingsannonser',
        definite_plural: 'stillingsannonsene',
      }),
    );

    expect(item.paradigm).toEqual({
      kind: 'noun',
      gender: 'masculine',
      indefiniteSingular: 'stillingsannonse',
      definiteSingular: 'stillingsannonsen',
      indefinitePlural: 'stillingsannonser',
      definitePlural: 'stillingsannonsene',
    });
  });

  it('lays a verb out as infinitive plus tenses', () => {
    const item = toFeShape(
      backendItem({ present_tense: 'søker', past_tense: 'søkte', perfect_tense: 'søkt' }, {
        word: 'søke',
        partOfSpeech: 'verb',
      }),
    );

    expect(item.paradigm).toEqual({
      kind: 'verb',
      verbClass: undefined,
      infinitive: 'søke',
      present: 'søker',
      past: 'søkte',
      perfect: 'søkt',
    });
  });

  it('reads plural_form as the adjective plural, not as a noun plural', () => {
    const item = toFeShape(
      backendItem({ neuter_form: 'erfarent', plural_form: 'erfarne' }, {
        word: 'erfaren',
        partOfSpeech: 'adjective',
      }),
    );

    expect(item.paradigm).toMatchObject({
      kind: 'adjective',
      positive: 'erfaren',
      neuter: 'erfarent',
      plural: 'erfarne',
    });
  });

  it('conjugates a verbal phrase, which has no paradigm of its own', () => {
    const item = toFeShape(
      backendItem(
        { present_tense: 'krysser fingrene', past_tense: 'krysset fingrene' },
        { word: 'krysse fingrene', partOfSpeech: 'phrase' },
      ),
    );

    expect(item.paradigm).toMatchObject({ kind: 'verb', infinitive: 'krysse fingrene' });
  });

  it('keeps verb_class, which is metadata rather than a surface form', () => {
    const item = toFeShape(
      backendItem({ present_tense: 'søker', verb_class: 'weak_2' }, { partOfSpeech: 'verb' }),
    );

    expect(item.paradigm).toMatchObject({ verbClass: 'weak_2' });
    // …and it still never reaches the flat list.
    expect(item.forms?.map((f) => f.value)).toEqual(['søker']);
  });

  it('omits the paradigm when only metadata is present — a lemma-only table teaches nothing', () => {
    expect(toFeShape(backendItem({ gender: 'neuter', verb_class: 'weak_1' })).paradigm).toBeUndefined();
  });

  it('omits the paradigm for the free-text authoring shape, whose labels have no cells', () => {
    const item = toFeShape(backendItem({ forms: [['Bestemt entall', 'sykepleieren']] }));
    expect(item.paradigm).toBeUndefined();
    expect(item.forms).toHaveLength(1);
  });

  it('rejects a gender the schema does not define', () => {
    const item = toFeShape(backendItem({ gender: 'animate', definite_singular: 'huset' }));
    expect(item.paradigm).toMatchObject({ kind: 'noun', gender: undefined });
  });
});
