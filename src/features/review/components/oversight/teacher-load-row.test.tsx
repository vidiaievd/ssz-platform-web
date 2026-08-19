import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { TeacherLoadRow } from './teacher-load-row';
import type { OversightTeacher } from '../../types/oversight';

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const teacher = (over: Partial<OversightTeacher> = {}): OversightTeacher => ({
  id: 't1',
  name: 'Per Nygård',
  groups: ['B1 kveld'],
  pending: 6,
  overdue: 2,
  ages: [1, 2, 3, 4, 60, 90],
  medianHours: 21,
  shared: false,
  ...over,
});

describe('TeacherLoadRow', () => {
  it('draws the queue rather than only counting it', () => {
    const { container } = renderWithIntl(<TeacherLoadRow teacher={teacher()} slaHours={48} />);

    expect(screen.getByText('6')).toBeInTheDocument();
    // Six bars for six submissions: two queues of the same size and different tails are
    // the whole reason this row is not a number (criterion 28).
    expect(screen.getByRole('img', { name: /submissions/ })).toHaveAccessibleName(
      '6 submissions, oldest 3 days',
    );
    expect(container.querySelectorAll('span[style*="background"]').length).toBeGreaterThanOrEqual(
      6,
    );
  });

  it('says when a queue is counted for two people, so the rows can exceed the school total', () => {
    renderWithIntl(<TeacherLoadRow teacher={teacher({ shared: true })} slaHours={48} />);
    expect(screen.getByText(/shared with a colleague/)).toBeInTheDocument();
  });

  it('leaves the shared caption off a teacher who reviews alone', () => {
    renderWithIntl(<TeacherLoadRow teacher={teacher()} slaHours={48} />);
    expect(screen.queryByText(/shared with a colleague/)).not.toBeInTheDocument();
  });

  it('writes a dash rather than a zero where nothing is late', () => {
    renderWithIntl(<TeacherLoadRow teacher={teacher({ overdue: 0 })} slaHours={48} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('says so plainly when this teacher answered nothing in the period', () => {
    renderWithIntl(<TeacherLoadRow teacher={teacher({ medianHours: null })} slaHours={48} />);
    expect(screen.getByText(/nothing answered in this period/)).toBeInTheDocument();
  });

  it('drops the histogram where no promise exists to colour it against', () => {
    renderWithIntl(<TeacherLoadRow teacher={teacher()} slaHours={null} />);
    expect(screen.queryByRole('img', { name: /submissions/ })).not.toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
