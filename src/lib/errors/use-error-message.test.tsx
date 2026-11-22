import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Echo "<namespace>.<key>" so the test sees which table a message came from.
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

import { useErrorMessage } from './use-error-message';

function message(error: Parameters<ReturnType<typeof useErrorMessage>>[0]) {
  return renderHook(() => useErrorMessage()).result.current(error);
}

describe('useErrorMessage', () => {
  it('uses the generic text of the code when the body says nothing special', () => {
    expect(message({ code: 'conflict', details: { error: { code: 'SOMETHING_ELSE' } } })).toBe('Errors.conflict');
    expect(message({ code: 'validation' })).toBe('Errors.validation');
  });

  it('explains a refusal because the school is read only', () => {
    const suspended = { code: 'conflict' as const, details: { error: { code: 'SCHOOL_NOT_ACTIVE', status: 'suspended' } } };
    const closed = { code: 'conflict' as const, details: { code: 'SCHOOL_NOT_ACTIVE', schoolStatus: 'closed' } };
    expect(message(suspended)).toBe('SchoolLifecycle.errors.schoolSuspended');
    expect(message(closed)).toBe('SchoolLifecycle.errors.schoolClosed');
  });

  it('explains a retired course', () => {
    expect(message({ code: 'conflict', details: { error: { code: 'COURSE_OBSOLETE' } } })).toBe(
      'SchoolLifecycle.errors.courseObsolete',
    );
  });

  it('takes a bare code straight to the generic text', () => {
    expect(message('unknown')).toBe('Errors.unknown');
  });
});
