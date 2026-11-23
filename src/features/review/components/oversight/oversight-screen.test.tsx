import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { SchoolWritableProvider } from '@/features/school-lifecycle';

import type { OversightStuck, OversightTeacher, ReviewOversightResponse } from '../../types/oversight';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/en/w/s1/review/oversight',
  useSearchParams: () => new URLSearchParams(),
}));

const teacher: OversightTeacher = {
  id: 't1',
  name: 'Per Nygård',
  groups: ['B1 kveld'],
  groupIds: ['g1'],
  pending: 6,
  overdue: 2,
  ages: [1, 2, 3, 4, 60, 90],
  medianHours: 21,
  shared: false,
  terms: null,
  heldHoursPerWeek: null,
};

const stuck: OversightStuck = {
  id: 'a1',
  studentId: 'st1',
  studentName: 'Kari',
  exerciseTitle: 'Skriv om helgen',
  groupId: 'g1',
  groupName: 'B1 kveld',
  teacherName: 'Per Nygård',
  submittedAt: '2026-11-20T10:00:00.000Z',
  hours: 70,
  slaHours: 48,
  unassigned: false,
};

const data = {
  schoolId: 's1',
  schoolSlaHours: 48,
  heldWeeks: null,
  terms: null,
  teachers: [teacher],
  groups: [{ id: 'g1', name: 'B1 kveld' }],
  courses: [],
  stuck: [stuck],
} as unknown as ReviewOversightResponse;

vi.mock('../../api/use-oversight', () => ({
  useOversight: () => ({ data, isPending: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('../../api/use-remind-reviewer', () => ({
  useRemindReviewer: () => ({ mutate: vi.fn(), isPending: false }),
}));
// The sections that only describe, and the dialog, are out of this test's question.
vi.mock('./school-summary', () => ({ SchoolSummary: () => null }));
vi.mock('./load-panels', () => ({ GroupLoadPanel: () => null, CourseLoadPanel: () => null }));
vi.mock('./decision-log', () => ({ DecisionLog: () => null }));
vi.mock('./assign-reviewer-dialog', () => ({ AssignReviewerDialog: () => null }));

const { OversightScreen } = await import('./oversight-screen');

const t = enMessages.Review.oversight;

function renderScreen(status: 'active' | 'suspended' | 'closed') {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SchoolWritableProvider status={status}>
        <OversightScreen school="s1" />
      </SchoolWritableProvider>
    </NextIntlClientProvider>,
  );
}

describe('OversightScreen in a school that takes no changes (plan 90, block 9)', () => {
  it('offers remind, add helper and assign in an active school', () => {
    renderScreen('active');
    expect(screen.getByRole('button', { name: t.teachers.remind })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.teachers.addHelper })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.stuck.assign })).toBeInTheDocument();
  });

  it.each(['suspended', 'closed'] as const)('only reads in a %s school', (status) => {
    renderScreen(status);
    expect(screen.getByText('Per Nygård')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.teachers.remind })).toBeNull();
    expect(screen.queryByRole('button', { name: t.teachers.addHelper })).toBeNull();
    expect(screen.queryByRole('button', { name: t.stuck.assign })).toBeNull();
    // "Review it yourself" is a link and reads, so it stays.
    expect(screen.getByRole('link', { name: t.stuck.reviewIt })).toBeInTheDocument();
  });
});
