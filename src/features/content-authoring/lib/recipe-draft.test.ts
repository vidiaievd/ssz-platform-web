import { describe, expect, it } from 'vitest';

import { RECIPE_PRESET_IDS, RECIPE_PRESETS } from '@/lib/shared-kernel/skills';

import {
  canon,
  fromDraft,
  invalidRuleNumbers,
  isDirty,
  matchPreset,
  newRule,
  presetDraft,
  ruleChange,
  ruleErrors,
  setAxis,
  setBound,
  toDraft,
  toRecipe,
  toggleValue,
  type DraftRule,
} from './recipe-draft';

const rule = (over: Partial<DraftRule> = {}): DraftRule => ({
  id: 'r1',
  axis: 'output',
  values: ['written_target'],
  negate: false,
  bound: 'min',
  n: '1',
  ...over,
});

describe('between the stored and the edited shape', () => {
  it('keeps a ceiling in whole percent while it is edited', () => {
    const draft = toDraft({ axis: 'modality', values: ['recognition'], maxShare: 0.6 }, 'x');
    expect(draft).toEqual({
      id: 'x',
      axis: 'modality',
      values: ['recognition'],
      negate: false,
      bound: 'maxShare',
      n: '60',
    });
    expect(fromDraft(draft)).toEqual({ axis: 'modality', values: ['recognition'], maxShare: 0.6 });
  });

  it('sends the values in the axis order, not the order they were ticked', () => {
    expect(fromDraft(rule({ axis: 'input', values: ['video', 'audio'] }))?.values).toEqual([
      'audio',
      'video',
    ]);
  });

  it('round-trips every preset unchanged', () => {
    for (const id of RECIPE_PRESET_IDS)
      expect(toRecipe(presetDraft(id))).toEqual(RECIPE_PRESETS[id]);
  });

  it('refuses the whole draft when one rule does not parse', () => {
    expect(toRecipe([rule(), rule({ id: 'r2', values: [] })])).toBeNull();
  });

  it('keeps an empty recipe as a recipe of no rules', () => {
    expect(toRecipe([])).toEqual({ rules: [] });
  });

  it('refuses more than twenty rules', () => {
    const many = Array.from({ length: 21 }, (_, i) => rule({ id: `r${i}` }));
    expect(toRecipe(many)).toBeNull();
    expect(toRecipe(many.slice(0, 20))?.rules).toHaveLength(20);
  });
});

describe('ruleErrors', () => {
  it('asks for a value', () => {
    expect(ruleErrors(rule({ values: [] }))).toEqual([{ field: 'values', key: 'tickOne' }]);
  });

  it.each(['0', '', ' ', '1.5', '-1', 'x'])('refuses a floor of %j', (n) => {
    expect(ruleErrors(rule({ n }))).toEqual([{ field: 'n', key: 'minOne' }]);
  });

  it.each(['100', '', '2.5', '-3'])('refuses a share of %j', (n) => {
    expect(ruleErrors(rule({ bound: 'maxShare', n }))).toEqual([{ field: 'n', key: 'shareRange' }]);
  });

  it('accepts a share of 0 and of 99', () => {
    expect(ruleErrors(rule({ bound: 'maxShare', n: '0' }))).toEqual([]);
    expect(ruleErrors(rule({ bound: 'maxShare', n: '99' }))).toEqual([]);
  });

  it('agrees with the kernel on what is valid', () => {
    for (const n of ['0', '1', '7', '99', '100', '', 'x'])
      for (const bound of ['min', 'maxShare'] as const)
        for (const values of [[], ['none']]) {
          const draft = rule({ bound, n, values });
          expect(ruleErrors(draft).length === 0).toBe(fromDraft(draft) !== null);
        }
  });

  it('numbers the rules that need a fix from one', () => {
    expect(invalidRuleNumbers([rule(), rule({ values: [] }), rule(), rule({ n: '' })])).toEqual([
      2, 4,
    ]);
  });
});

describe('edits', () => {
  it('clears the values when the axis changes', () => {
    expect(setAxis(rule(), 'input')).toMatchObject({ axis: 'input', values: [] });
  });

  it('starts the number over when the bound changes', () => {
    expect(setBound(rule({ n: '4' }), 'maxShare').n).toBe('50');
    expect(setBound(rule({ bound: 'maxShare', n: '30' }), 'min').n).toBe('1');
  });

  it('ticks and unticks a value', () => {
    const ticked = toggleValue(rule({ values: [] }), 'none');
    expect(ticked.values).toEqual(['none']);
    expect(toggleValue(ticked, 'none').values).toEqual([]);
  });

  it('adds an empty rule that waits for a value', () => {
    const fresh = newRule();
    expect(fresh).toMatchObject({ axis: 'input', values: [], bound: 'min', n: '1' });
    expect(ruleErrors(fresh)).toEqual([{ field: 'values', key: 'tickOne' }]);
  });
});

describe('comparing drafts', () => {
  it('ignores the order of values but not the order of rules', () => {
    const a = rule({ axis: 'input', values: ['audio', 'video'] });
    const b = rule({ id: 'r2', axis: 'input', values: ['video', 'audio'] });
    expect(canon([a])).toBe(canon([b]));
    expect(canon([a, rule()])).not.toBe(canon([rule(), a]));
  });

  it('reads 07 as 7', () => {
    expect(canon([rule({ n: '07' })])).toBe(canon([rule({ n: '7' })]));
  });

  it('tells never-set from set-to-nothing', () => {
    expect(isDirty([], null)).toBe(false);
    expect(isDirty([rule()], null)).toBe(true);
    expect(isDirty([], [])).toBe(false);
    expect(isDirty([], [rule()])).toBe(true);
  });

  it('is clean again once an edit is undone by hand', () => {
    const saved = [rule()];
    const edited = [setBound(rule(), 'maxShare')];
    expect(isDirty(edited, saved)).toBe(true);
    expect(isDirty([setBound(edited[0]!, 'min')], saved)).toBe(false);
  });
});

describe('matchPreset', () => {
  it('recognises every preset, whatever the ids', () => {
    for (const id of RECIPE_PRESET_IDS) expect(matchPreset(presetDraft(id))).toBe(id);
  });

  it('stops recognising a preset once a rule is edited', () => {
    const rules = presetDraft('balanced_a1_a2');
    rules[2] = { ...rules[2]!, n: '61' };
    expect(matchPreset(rules)).toBeNull();
  });

  it('names no preset for an empty list', () => {
    expect(matchPreset([])).toBeNull();
  });
});

describe('ruleChange', () => {
  it('shows no badges before the first save', () => {
    expect(ruleChange(rule(), null)).toBeNull();
  });

  it('marks a rule the saved version does not have as new', () => {
    expect(ruleChange(rule({ id: 'other' }), [rule()])).toBe('new');
  });

  it('marks a changed rule as edited, and an unchanged one not at all', () => {
    expect(ruleChange(rule({ n: '2' }), [rule()])).toBe('edited');
    expect(ruleChange(rule(), [rule()])).toBeNull();
  });
});
