import { describe, expect, it } from 'vitest';

import { mapPreflightViolation, type RuleViolation } from './map-preflight-violation';

const CTX = { schoolSlug: 'nordick', containerId: 'module-1' };

function violation(overrides: Partial<RuleViolation> = {}): RuleViolation {
  return {
    ruleCode: 'EXERCISE_INCOMPLETE',
    severity: 'blocker',
    itemType: 'EXERCISE',
    itemId: 'exercise-9',
    detail: 'Exercise has no instruction text',
    ...overrides,
  };
}

describe('mapPreflightViolation', () => {
  it('points an exercise at its own editor, not at the page the author is on', () => {
    // The fallback used to be the container page — the page the review screen
    // is opened from, so the link looked broken.
    const check = mapPreflightViolation(violation(), CTX);

    expect(check.fixDeepLink).toBe('/school/nordick/content/module-1/lessons/exercise-9');
  });

  it.each(['LESSON', 'VOCABULARY_LIST', 'GRAMMAR_RULE'])(
    'points a %s at the item editor route',
    (itemType) => {
      const check = mapPreflightViolation(violation({ itemType, itemId: 'ref-1' }), CTX);

      expect(check.fixDeepLink).toBe('/school/nordick/content/module-1/lessons/ref-1');
    },
  );

  it('points an empty module at the module itself', () => {
    const check = mapPreflightViolation(
      violation({ ruleCode: 'MODULE_EMPTY', itemType: 'CONTAINER', itemId: 'module-2' }),
      CTX,
    );

    expect(check.fixDeepLink).toBe('/school/nordick/content/module-2');
  });

  it('offers no link for rules that name no editable item', () => {
    const check = mapPreflightViolation(
      violation({ ruleCode: 'EMPTY_VERSION', itemType: 'VERSION', itemId: 'version-1' }),
      CTX,
    );

    // Better no affordance than one that goes nowhere.
    expect(check.fixDeepLink).toBeNull();
  });

  it('carries the rule code and the backend detail rather than English copy', () => {
    // The wording is the UI's job (`preflightCheckText`); mapping stays i18n-free.
    const check = mapPreflightViolation(violation(), CTX);

    expect(check.ruleCode).toBe('EXERCISE_INCOMPLETE');
    expect(check.detail).toBe('Exercise has no instruction text');
  });

  it('names the offending item from the version titles', () => {
    // "Exercise has no instructions" is unactionable in a module of sixteen items.
    const check = mapPreflightViolation(violation(), {
      ...CTX,
      itemTitles: new Map([['exercise-9', 'Multiple Choice Group']]),
    });

    expect(check.itemTitle).toBe('Multiple Choice Group');
  });

  it('leaves the item unnamed when the rule names something the version does not place', () => {
    // VOCAB_* rules name a word inside a list, never a container item.
    const check = mapPreflightViolation(
      violation({ ruleCode: 'VOCAB_NO_AUDIO', itemType: 'VOCABULARY_ITEM', itemId: 'word-3' }),
      { ...CTX, itemTitles: new Map([['exercise-9', 'Multiple Choice Group']]) },
    );

    expect(check.itemTitle).toBeNull();
  });
});
