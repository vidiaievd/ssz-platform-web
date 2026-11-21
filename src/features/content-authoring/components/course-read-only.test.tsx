import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { SchoolWritableProvider } from '@/features/school-lifecycle';

import { CourseReadOnlyNotice, CourseReadOnlyProvider } from './course-read-only';

function renderNotice(readOnly: boolean, status?: 'active' | 'suspended' | 'closed') {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SchoolWritableProvider status={status}>
        <CourseReadOnlyProvider readOnly={readOnly}>
          <CourseReadOnlyNotice />
        </CourseReadOnlyProvider>
      </SchoolWritableProvider>
    </NextIntlClientProvider>,
  );
}

describe('CourseReadOnlyNotice (plan 90, Q17 (a))', () => {
  it('says nothing while the course may be edited', () => {
    renderNotice(false, 'suspended');
    expect(screen.queryByTestId('course-read-only')).toBeNull();
  });

  it.each(['suspended', 'closed'] as const)('names the school, not the rights, in a %s school', (status) => {
    renderNotice(true, status);
    expect(screen.getByTestId('course-read-only')).toHaveTextContent(enMessages.Authoring.readOnly.school);
  });

  it('names the missing edit right in an active school', () => {
    renderNotice(true, 'active');
    expect(screen.getByTestId('course-read-only')).toHaveTextContent(enMessages.Authoring.readOnly.noRight);
  });
});
