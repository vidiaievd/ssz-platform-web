import { describe, expect, it } from 'vitest';

import type { StudentSchool } from '@/features/student/types';
import { showFindSchoolEntry } from './discover-visibility';

function school(status: StudentSchool['status']): StudentSchool {
  return { status } as unknown as StudentSchool;
}

describe('showFindSchoolEntry', () => {
  it('returns true when schools list is empty', () => {
    expect(showFindSchoolEntry([])).toBe(true);
  });

  it('returns true when all memberships are pending', () => {
    expect(showFindSchoolEntry([school('pending'), school('pending')])).toBe(true);
  });

  it('returns true when memberships are onboarding or placement-review only', () => {
    expect(showFindSchoolEntry([school('onboarding'), school('placement-review')])).toBe(true);
  });

  it('returns true when all memberships are rejected or left', () => {
    expect(showFindSchoolEntry([school('rejected'), school('left')])).toBe(true);
  });

  it('returns false when at least one membership is active', () => {
    expect(showFindSchoolEntry([school('pending'), school('active')])).toBe(false);
  });

  it('returns false when multiple memberships are active', () => {
    expect(showFindSchoolEntry([school('active'), school('active')])).toBe(false);
  });
});
