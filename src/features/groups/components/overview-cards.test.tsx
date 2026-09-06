import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@/test/render';
import { OverviewCards } from './overview-cards';
import type { Group } from '../types';

// TeacherRow (rendered for the primary teacher) imports this server-action
// module; its transitive deps touch server-only env vars that jsdom can't see.
vi.mock('../api/mutations', () => ({
  removeTeacher: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const baseGroup: Group = {
  id: 'g1',
  name: 'Norwegian A2',
  courseId: null,
  courseName: null,
  materials: [],
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
  ageBand: null,
};

function renderCards(overrides: Partial<{ group: Group; canManage: boolean }> = {}) {
  return renderWithProviders(
    <OverviewCards
      group={overrides.group ?? baseGroup}
      canManage={overrides.canManage ?? true}
      schoolId="11111111-1111-4111-8111-111111111111"
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

  it('shows the min/max seat caption beside the capacity meter', () => {
    renderCards({ group: { ...baseGroup, capacity: { min: 6, max: 12 } } });
    expect(screen.getByText('min 6 · max 12 seats')).toBeInTheDocument();
  });

  it('shows "Add" for an admin', () => {
    renderCards({ canManage: true });
    expect(screen.getAllByText('Add').length).toBeGreaterThan(0);
  });

  it('hides "Add" for a teacher (non-manager)', () => {
    renderCards({ canManage: false });
    expect(screen.queryByText('Add')).not.toBeInTheDocument();
  });

  it('shows the recurring-slots empty state when the group has no slots', () => {
    renderCards({ group: { ...baseGroup, slots: [] } });
    expect(screen.getByText('No recurring slots configured.')).toBeInTheDocument();
  });

  it('lists a recurring slot with its day, time and room', () => {
    renderCards({
      group: {
        ...baseGroup,
        slots: [{ day: 'Tue', start: '18:00', end: '19:30', room: 'Room 3' }],
      },
    });
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('18:00–19:30')).toBeInTheDocument();
    expect(screen.getByText('Room 3')).toBeInTheDocument();
  });
});
