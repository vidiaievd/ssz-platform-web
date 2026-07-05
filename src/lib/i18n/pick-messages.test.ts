import { describe, expect, it } from 'vitest';

import { enMessages } from './messages';
import { pickMessages } from './pick-messages';

describe('pickMessages', () => {
  it('returns only the requested namespaces', () => {
    const result = pickMessages(enMessages, ['Common', 'Errors']);
    expect(Object.keys(result)).toEqual(['Common', 'Errors']);
  });

  it('preserves the original namespace values', () => {
    const result = pickMessages(enMessages, ['Common']);
    expect(result.Common).toBe(enMessages.Common);
  });

  it('result keys are exactly the intersection of input list and catalog', () => {
    const result = pickMessages(enMessages, ['Nav', 'Theme', 'UserMenu']);
    expect(Object.keys(result).sort()).toEqual(['Nav', 'Theme', 'UserMenu']);
  });

  it('returns an empty object when given an empty list', () => {
    const result = pickMessages(enMessages, []);
    expect(result).toEqual({});
  });
});
