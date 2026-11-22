import { describe, expect, it } from 'vitest';
import { isObsoleteHistoryOnly } from './obsolete-course';

describe('isObsoleteHistoryOnly (plan 90, Q11)', () => {
  it('a course the purge kept is history only', () => {
    expect(isObsoleteHistoryOnly({ maintenanceSource: 'school' })).toBe(true);
  });

  it.each(['closed', 'purged'] as const)(
    'a course of a %s school is history only',
    (schoolStatus) => {
      expect(isObsoleteHistoryOnly({ maintenanceSource: 'author', schoolStatus })).toBe(true);
    },
  );

  it.each([
    ['retired by its author, no school', { maintenanceSource: 'author' as const }],
    [
      'retired by its author in an active school',
      { maintenanceSource: 'author' as const, schoolStatus: 'active' as const },
    ],
    [
      'retired by its author in a suspended school',
      { maintenanceSource: 'author' as const, schoolStatus: 'suspended' as const },
    ],
    ['no source recorded', { maintenanceSource: null }],
  ])('%s: learners already on it carry on', (_label, facts) => {
    expect(isObsoleteHistoryOnly(facts)).toBe(false);
  });
});
