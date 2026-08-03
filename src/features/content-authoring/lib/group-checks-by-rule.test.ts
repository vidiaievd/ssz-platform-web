import { describe, expect, it } from 'vitest';

import type { PreflightCheck } from '../types';
import { groupChecksByRule } from './group-checks-by-rule';

function check(ruleCode: string, itemId: string, itemTitle: string | null = null): PreflightCheck {
  return {
    id: `${ruleCode}:${itemId}`,
    severity: 'warning',
    ruleCode,
    itemTitle,
    detail: 'detail',
    fixDeepLink: null,
  };
}

describe('groupChecksByRule', () => {
  it('collapses a rule repeated per item into one group', () => {
    // 26 VOCAB_NO_AUDIO lines bury the two warnings about something else.
    const groups = groupChecksByRule([
      check('VOCAB_NO_AUDIO', 'word-1'),
      check('VOCAB_NO_AUDIO', 'word-2'),
      check('VOCAB_NO_AUDIO', 'word-3'),
      check('NO_GRAMMAR', 'course-1'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.ruleCode).toBe('VOCAB_NO_AUDIO');
    expect(groups[0]?.checks).toHaveLength(3);
  });

  it('keeps first-seen order rather than sorting by size', () => {
    const groups = groupChecksByRule([
      check('NO_GRAMMAR', 'course-1'),
      check('VOCAB_NO_AUDIO', 'word-1'),
      check('VOCAB_NO_AUDIO', 'word-2'),
    ]);

    expect(groups.map((g) => g.ruleCode)).toEqual(['NO_GRAMMAR', 'VOCAB_NO_AUDIO']);
  });

  it('exposes a lone check so it can be named and linked', () => {
    const groups = groupChecksByRule([check('NO_GRAMMAR', 'course-1', 'Norsk B1')]);

    expect(groups[0]?.only?.itemTitle).toBe('Norsk B1');
  });

  it('exposes no lone check once a rule repeats', () => {
    const groups = groupChecksByRule([
      check('VOCAB_NO_AUDIO', 'word-1', 'jobb'),
      check('VOCAB_NO_AUDIO', 'word-2', 'arbeid'),
    ]);

    expect(groups[0]?.only).toBeNull();
  });

  it('returns nothing for no checks', () => {
    expect(groupChecksByRule([])).toEqual([]);
  });
});
