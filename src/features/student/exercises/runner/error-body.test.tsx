import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { rememberSchoolRefusal } from '@/features/school-lifecycle/types';
import { RunnerErrorBody } from './error-body';

const messages = {
  ExerciseRunner: { error: { title: 'Something went wrong', body: 'Generic body', retry: 'Try again' } },
  SchoolLifecycle: {
    errors: {
      schoolNotActiveTitle: 'The school is not accepting new work',
      schoolSuspended: 'The school is temporarily blocked',
      schoolClosed: 'The school is closed',
    },
  },
};

function renderBody() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RunnerErrorBody onRetry={vi.fn()} accent="red" />
    </NextIntlClientProvider>,
  );
}

describe('RunnerErrorBody', () => {
  it('says why a start was refused by a suspended school, with no retry', () => {
    rememberSchoolRefusal('suspended');
    renderBody();
    expect(screen.getByText('The school is not accepting new work')).toBeTruthy();
    expect(screen.getByText('The school is temporarily blocked')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('words a closed school differently', () => {
    rememberSchoolRefusal('closed');
    renderBody();
    expect(screen.getByText('The school is closed')).toBeTruthy();
  });

  it('keeps the generic text and retry after the refusal is forgotten', () => {
    vi.useFakeTimers();
    rememberSchoolRefusal('suspended');
    vi.setSystemTime(Date.now() + 60_000);
    renderBody();
    vi.useRealTimers();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
