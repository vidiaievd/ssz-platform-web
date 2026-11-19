import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { rememberSchoolRefusal } from '@/features/school-lifecycle/types';
import { ErrorState } from './error-state';

const messages = {
  Learning: { errorState: { default: 'Something went wrong', retry: 'Try again' } },
  SchoolLifecycle: {
    errors: {
      schoolNotActiveTitle: 'The school is not accepting new work',
      schoolSuspended: 'The school is temporarily blocked',
      schoolClosed: 'The school is closed',
    },
  },
};

function renderState() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ErrorState onRetry={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe('ErrorState', () => {
  it('names a school refusal and drops the retry', () => {
    rememberSchoolRefusal('suspended');
    renderState();
    expect(screen.getByText('The school is not accepting new work')).toBeTruthy();
    expect(screen.getByText('The school is temporarily blocked')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('keeps the generic text once the refusal is old', () => {
    vi.useFakeTimers();
    rememberSchoolRefusal('suspended');
    vi.setSystemTime(Date.now() + 60_000);
    renderState();
    vi.useRealTimers();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
