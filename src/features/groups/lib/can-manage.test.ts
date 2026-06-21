import { describe, it, expect } from 'vitest';

import { canManageGroups } from './can-manage';
import type { SchoolRole } from '@/features/school/types';

describe('canManageGroups', () => {
  it.each<[SchoolRole, boolean]>([
    ['OWNER', true],
    ['ADMIN', true],
    ['MANAGER', true],
    ['TEACHER', false],
  ])('returns %s -> %s', (role, expected) => {
    expect(canManageGroups(role)).toBe(expected);
  });

  it('returns false when role is null', () => {
    expect(canManageGroups(null)).toBe(false);
  });
});
