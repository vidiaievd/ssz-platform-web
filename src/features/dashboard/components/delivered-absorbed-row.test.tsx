import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';
import { DeliveredAbsorbedRow } from './delivered-absorbed-row';
import type { GroupGap } from '@/lib/dashboard/types';

const WS = 'ws-1';

function gap(over: Partial<GroupGap> & { name: string }): GroupGap {
  return {
    groupId: over.name,
    courseId: 'c1',
    courseTitle: 'Ny i Norge A2',
    students: 5,
    delivered: 80,
    absorbed: 60,
    state: 'ok',
    ...over,
  };
}

function renderWidget(groups: GroupGap[]) {
  return renderWithProviders(
    <DeliveredAbsorbedRow gaps={{ status: 'ok', data: groups }} workspaceId={WS} />,
  );
}

describe('ordering', () => {
  it('puts the widest gap first by default', async () => {
    renderWidget([
      gap({ name: 'Narrow', delivered: 50, absorbed: 48 }),
      gap({ name: 'Wide', delivered: 90, absorbed: 40 }),
      gap({ name: 'Middling', delivered: 70, absorbed: 50 }),
    ]);

    const names = screen.getAllByRole('link').map((link) => within(link).getAllByText(/./)[0]?.textContent);
    expect(names).toEqual(['Wide', 'Middling', 'Narrow']);
  });

  it('leaves the list in the order it came in when asked for all groups', async () => {
    renderWidget([
      gap({ name: 'Narrow', delivered: 50, absorbed: 48 }),
      gap({ name: 'Wide', delivered: 90, absorbed: 40 }),
    ]);

    await userEvent.click(screen.getByRole('radio', { name: 'All groups' }));

    const names = screen.getAllByRole('link').map((link) => within(link).getAllByText(/./)[0]?.textContent);
    expect(names).toEqual(['Narrow', 'Wide']);
  });
});

describe('what cannot be compared', () => {
  it('is kept out of the sorted list and given its own heading', () => {
    renderWidget([
      gap({ name: 'Running', delivered: 90, absorbed: 40 }),
      gap({ name: 'Club', courseId: null, courseTitle: null, delivered: null, absorbed: null, state: 'noCourse' }),
      gap({ name: 'Fresh', delivered: 12, absorbed: null, state: 'noAttempts' }),
    ]);

    expect(screen.getByText('Not comparable yet')).toBeInTheDocument();
    expect(screen.getByText('No course attached — nothing to compare')).toBeInTheDocument();
    expect(screen.getByText('Taught 12%, no attempts yet')).toBeInTheDocument();
  });

  it('never prints a gap of zero for a group that has no second number', () => {
    renderWidget([
      gap({ name: 'Fresh', delivered: 12, absorbed: null, state: 'noAttempts' }),
    ]);

    expect(screen.queryByText('0 pt')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('says the timetable was unreachable rather than calling the course untaught', () => {
    renderWidget([
      gap({ name: 'Unknown', delivered: null, absorbed: null, state: 'noAttempts' }),
    ]);

    expect(screen.getByText('We could not ask the timetable')).toBeInTheDocument();
  });
});

describe('the row as a link', () => {
  it('opens the group on its own progress tab', () => {
    renderWidget([gap({ name: 'Running', groupId: 'g1' })]);

    expect(screen.getByRole('link')).toHaveAttribute('href', `/w/${WS}/groups/g1?tab=progress`);
  });
});

describe('a school with no groups', () => {
  it('says so instead of drawing an empty chart', () => {
    renderWidget([]);

    expect(screen.getByText('No groups yet')).toBeInTheDocument();
  });
});
