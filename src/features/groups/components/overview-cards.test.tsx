import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { OverviewCards } from './overview-cards';
import type { Group, RosterStudent, Lesson, CourseView } from '../types';
import type { Alert } from '@/features/dashboard/types';

// TeacherRow (rendered for the primary teacher) imports this server-action
// module; its transitive deps touch server-only env vars that jsdom can't see.
vi.mock('../api/mutations', () => ({
  removeTeacher: vi.fn(),
}));

const baseGroup: Group = {
  id: 'g1',
  name: 'Norwegian A2',
  courseId: null,
  courseName: null,
  lang: 'nb',
  level: 'A2',
  status: 'active',
  mode: 'online',
  capacity: { min: 6, max: 12 },
  studentCount: 0,
  startDate: null,
  endDate: null,
  teachers: [],
  slots: [],
};

const courseView: CourseView = {
  courseId: null,
  courseName: null,
  lang: 'nb',
  level: 'A2',
  unitCount: null,
};

function renderCards(overrides: Partial<{
  group: Group;
  roster: RosterStudent[];
  lessons: Lesson[];
  alerts: Alert[];
  canManage: boolean;
}> = {}) {
  return renderWithProviders(
    <OverviewCards
      group={overrides.group ?? baseGroup}
      roster={overrides.roster ?? []}
      lessons={overrides.lessons ?? []}
      alerts={overrides.alerts ?? []}
      courseView={courseView}
      canManage={overrides.canManage ?? true}
      schoolSlug="my-school"
    />,
  );
}

describe('OverviewCards', () => {
  it('shows "Assign primary" for an admin when there is no primary teacher', () => {
    renderCards({ canManage: true });
    expect(screen.getByText('No primary teacher')).toBeInTheDocument();
    expect(screen.getByText('Assign primary')).toBeInTheDocument();
  });

  it('hides "Assign primary" for a teacher (non-manager)', () => {
    renderCards({ canManage: false });
    expect(screen.getByText('No primary teacher')).toBeInTheDocument();
    expect(screen.queryByText('Assign primary')).not.toBeInTheDocument();
  });

  it('shows "Add students" for an admin when there are 0 students', () => {
    renderCards({ group: { ...baseGroup, studentCount: 0 }, canManage: true });
    expect(screen.getByText('No students enrolled yet.')).toBeInTheDocument();
    expect(screen.getByText('Add students')).toBeInTheDocument();
  });

  it('hides "Add students" for a teacher when there are 0 students', () => {
    renderCards({ group: { ...baseGroup, studentCount: 0 }, canManage: false });
    expect(screen.queryByText('Add students')).not.toBeInTheDocument();
  });

  it('shows "No upcoming lessons" when the lesson list is empty', () => {
    renderCards({ lessons: [] });
    expect(screen.getByText('No upcoming lessons scheduled.')).toBeInTheDocument();
  });
});
