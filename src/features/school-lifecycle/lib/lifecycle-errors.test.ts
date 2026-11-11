import { describe, expect, it } from 'vitest';

import { daysLeft } from './days-left';
import { isCourseObsolete, lifecycleErrorKey, lifecycleErrorKeyOf, schoolNotActiveStatus } from './lifecycle-errors';

describe('schoolNotActiveStatus', () => {
  it('reads organization, exercise-engine and content shapes', () => {
    expect(schoolNotActiveStatus({ error: { code: 'SCHOOL_NOT_ACTIVE', status: 'suspended' } })).toBe('suspended');
    expect(schoolNotActiveStatus({ code: 'SCHOOL_NOT_ACTIVE', schoolStatus: 'closed' })).toBe('closed');
    expect(schoolNotActiveStatus({ code: 'SCHOOL_NOT_ACTIVE' })).toBe('suspended');
  });
  it('treats purged as closed', () => {
    expect(schoolNotActiveStatus({ code: 'SCHOOL_NOT_ACTIVE', schoolStatus: 'purged' })).toBe('closed');
  });
  it('ignores other conflicts and junk', () => {
    expect(schoolNotActiveStatus({ error: { code: 'SEATS_EXHAUSTED' } })).toBeNull();
    expect(schoolNotActiveStatus(null)).toBeNull();
    expect(schoolNotActiveStatus('x')).toBeNull();
  });
});

describe('lifecycleErrorKey', () => {
  it('maps each refusal to a message key', () => {
    expect(lifecycleErrorKey({ code: 'SCHOOL_NOT_ACTIVE', schoolStatus: 'closed' })).toBe('schoolClosed');
    expect(lifecycleErrorKey({ code: 'SCHOOL_NOT_ACTIVE', schoolStatus: 'suspended' })).toBe('schoolSuspended');
    expect(lifecycleErrorKey({ error: 'COURSE_OBSOLETE' })).toBe('courseObsolete');
    expect(lifecycleErrorKey({ message: 'COURSE_OBSOLETE' })).toBe('courseObsolete');
    expect(lifecycleErrorKey({ error: 'Already enrolled' })).toBeNull();
  });
  it('reads an AppError-like details body', () => {
    expect(lifecycleErrorKeyOf({ details: { error: { code: 'SCHOOL_NOT_ACTIVE', status: 'suspended' } } })).toBe(
      'schoolSuspended',
    );
    expect(lifecycleErrorKeyOf(undefined)).toBeNull();
    expect(isCourseObsolete({ error: 'COURSE_OBSOLETE' })).toBe(true);
  });
});

describe('daysLeft', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  it('rounds up and floors at zero', () => {
    expect(daysLeft('2026-11-14T00:00:00Z', now)).toBe(3);
    expect(daysLeft('2026-11-01T00:00:00Z', now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft('nope', now)).toBeNull();
  });
});
