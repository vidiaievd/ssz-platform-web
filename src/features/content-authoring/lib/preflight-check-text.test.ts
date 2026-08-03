import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { PreflightCheck } from '../types';
import { KNOWN_RULE_CODES, preflightCheckText, type RuleTranslator } from './preflight-check-text';

const RULES = enMessages.Authoring.preflightRules as unknown as Record<
  string,
  string | { title: string; fix: string }
>;

// Resolves 'CODE.title' / 'withItem' against the real en messages, the way
// next-intl would, so a missing key fails here instead of in the browser.
const t: RuleTranslator = (key, values) => {
  const [code = '', field] = key.split('.');
  const entry = RULES[code];
  if (typeof entry === 'string') {
    return entry.replace(/\{(\w+)\}/g, (_, name: string) => values?.[name] ?? `{${name}}`);
  }
  if (!entry) throw new Error(`Missing message: ${key}`);
  return field === 'fix' ? entry.fix : entry.title;
};

function check(overrides: Partial<PreflightCheck> = {}): PreflightCheck {
  return {
    id: 'EXERCISE_INCOMPLETE:exercise-9',
    severity: 'blocker',
    ruleCode: 'EXERCISE_INCOMPLETE',
    itemTitle: null,
    detail: 'Exercise has no instruction text',
    fixDeepLink: null,
    ...overrides,
  };
}

describe('preflightCheckText', () => {
  it('names the offending item in the title', () => {
    const { title } = preflightCheckText(t, check({ itemTitle: 'Multiple Choice Group' }));

    expect(title).toBe('Exercise has no instructions: Multiple Choice Group');
  });

  it('falls back to the bare rule wording when nothing is named', () => {
    const { title, fixHint } = preflightCheckText(t, check());

    expect(title).toBe('Exercise has no instructions');
    expect(fixHint).toBe('Open the exercise and write what the student must do');
  });

  it("uses the backend's own wording for a rule the UI has no copy for", () => {
    // A rule added in content-service must not render `preflightRules.X.title`.
    const { title, fixHint } = preflightCheckText(
      t,
      check({ ruleCode: 'BRAND_NEW_RULE', detail: 'Something the UI has no copy for' }),
    );

    expect(title).toBe('Something the UI has no copy for');
    expect(fixHint).toBeNull();
  });

  it('has copy for every rule code it claims to know', () => {
    for (const code of KNOWN_RULE_CODES) {
      expect(RULES[code], `missing copy for ${code}`).toBeDefined();
    }
  });
});
