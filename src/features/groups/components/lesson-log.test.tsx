import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test/render';
import { LessonLog } from './lesson-log';
import type { GroupTeacher, OutlineUnit, Session } from '../types';

const STAFF = { primaryId: 'maria', coPrimaryId: null };

const TEACHERS: GroupTeacher[] = [
  { userId: 'maria', name: 'Maria Solberg', role: 'primary' },
  { userId: 'nina', name: 'Nina Berg', role: 'substitute' },
];

const UNITS: OutlineUnit[] = [
  {
    id: 'u1',
    title: 'Meetings',
    order: 2,
    items: [{ id: 'l1', itemType: 'lesson', kind: 'text', title: 'Conditionals' }],
  },
];

function session(over: Partial<Session> & { id: string; date: string }): Session {
  return {
    groupId: 'g1',
    schoolId: 'sc1',
    slotId: null,
    start: '09:00',
    end: '10:30',
    teacherId: 'maria',
    room: 'Room 4',
    status: 'held',
    type: 'lesson',
    curriculumUnitId: null,
    contentUnitId: 'u1',
    contentLessonId: 'l1',
    attendance: 12,
    note: null,
    extra: false,
    planIndex: 0,
    passMark: null,
    scores: [],
    ...over,
  };
}

// Eight held sessions, all in the past, so `recent` shows them all.
const HELD = Array.from({ length: 8 }, (_, i) =>
  session({ id: `s${i}`, date: `2020-01-0${i + 1}` }),
);

function renderLog(sessions: Session[], filter: 'recent' | 'issues' = 'recent') {
  return renderWithProviders(
    <LessonLog
      sessions={sessions}
      units={UNITS}
      teachers={TEACHERS}
      staff={STAFF}
      studentCount={14}
      filter={filter}
      onFilterChange={() => {}}
      onEditSession={() => {}}
    />,
  );
}

describe('LessonLog', () => {
  it('names the topic, who taught it and how many turned up', () => {
    renderLog([HELD[0]!]);

    expect(screen.getByText('Conditionals')).toBeInTheDocument();
    expect(screen.getByText('Maria Solberg')).toBeInTheDocument();
    expect(screen.getByText('12/14')).toBeInTheDocument();
    expect(screen.getByText('Unit 2 · Meetings')).toBeInTheDocument();
  });

  it('shows six rows, then the rest on request', async () => {
    renderLog(HELD);
    expect(screen.getAllByText('Conditionals')).toHaveLength(6);

    await userEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(screen.getAllByText('Conditionals')).toHaveLength(8);
  });

  it('collapses again when the filter changes', async () => {
    const { rerender } = renderLog(HELD);
    await userEvent.click(screen.getByRole('button', { name: 'Show all 8' }));

    rerender(
      <LessonLog
        sessions={HELD}
        units={UNITS}
        teachers={TEACHERS}
        staff={STAFF}
        studentCount={14}
        filter="issues"
        onFilterChange={() => {}}
        onEditSession={() => {}}
      />,
    );
    rerender(
      <LessonLog
        sessions={HELD}
        units={UNITS}
        teachers={TEACHERS}
        staff={STAFF}
        studentCount={14}
        filter="recent"
        onFilterChange={() => {}}
        onEditSession={() => {}}
      />,
    );

    expect(screen.getAllByText('Conditionals')).toHaveLength(6);
  });

  it('says a session has no topic rather than leaving the row blank', () => {
    renderLog([session({ id: 'x', date: '2020-01-01', contentUnitId: null, contentLessonId: null })]);
    expect(screen.getByText('Topic not assigned')).toBeInTheDocument();
  });

  it('gives an exam its average instead of a turnout', () => {
    renderLog([
      session({
        id: 'e1',
        date: '2020-01-01',
        type: 'exam',
        attendance: null,
        scores: [
          { studentId: 'a', score: 80 },
          { studentId: 'b', score: 60 },
          // Ungraded, and so in neither the average nor the count.
          { studentId: 'c', score: null },
        ],
      }),
    ]);

    expect(screen.getByText('avg 70%')).toBeInTheDocument();
  });

  it('has an empty state instead of an empty card', () => {
    renderLog([], 'issues');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
