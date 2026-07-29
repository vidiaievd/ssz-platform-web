// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { toFeShape, type BackendItemFull } from './map-vocabulary-item';

function backendItem(grammaticalProperties: Record<string, unknown> | null): BackendItemFull {
  return {
    id: 'item-1',
    word: 'stillingsannonse',
    partOfSpeech: 'noun',
    ipaTranscription: null,
    grammaticalProperties,
    translations: [],
    usageExamples: [],
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
