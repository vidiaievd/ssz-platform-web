// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { resolveIntent } from './intent';

describe('resolveIntent', () => {
  it('returns explore when params are empty', () => {
    expect(resolveIntent(new URLSearchParams())).toEqual({ kind: 'explore' });
  });

  it('returns join_school when school param is present', () => {
    expect(resolveIntent(new URLSearchParams('school=oslo-language-school'))).toEqual({
      kind: 'join_school',
      schoolSlug: 'oslo-language-school',
    });
  });

  it('returns invited when invite param is present', () => {
    expect(resolveIntent(new URLSearchParams('invite=tok123'))).toEqual({
      kind: 'invited',
      token: 'tok123',
    });
  });

  it('invite token takes priority over school param', () => {
    const params = new URLSearchParams('invite=tok123&school=oslo-language-school');
    expect(resolveIntent(params)).toEqual({ kind: 'invited', token: 'tok123' });
  });
});
