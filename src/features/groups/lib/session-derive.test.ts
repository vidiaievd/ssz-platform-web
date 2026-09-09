import { describe, expect, it } from 'vitest';

import {
  courseSpan,
  coverageByUnit,
  deliveryStats,
  examStats,
  filterLog,
  gradeTone,
  isSubstitute,
  nextSession,
  stateOf,
  timelineWeeks,
  topicOf,
  weekOf,
  weeklyRhythm,
  whoTaught,
} from './session-derive';
import type { Session } from '../types';

const STAFF = { primaryId: 'maria', coPrimaryId: 'tom' };
const TODAY = '2026-09-20';

function session(over: Partial<Session> & { date: string }): Session {
  return {
    id: over.id ?? `s-${over.date}-${over.start ?? '09:00'}`,
    groupId: 'g1',
    schoolId: 'sc1',
    slotId: 'slot1',
    start: '09:00',
    end: '10:30',
    teacherId: 'maria',
    room: 'Room 4',
    status: 'scheduled',
    type: 'lesson',
    curriculumUnitId: null,
    contentUnitId: 'u1',
    contentLessonId: 'l1',
    attendance: null,
    note: null,
    extra: false,
    planIndex: 0,
    passMark: null,
    scores: [],
    ...over,
  };
}

describe('weeklyRhythm', () => {
  it('counts the pattern and its contact hours', () => {
    expect(
      weeklyRhythm([
        { start: '09:00', end: '10:30' },
        { start: '18:00', end: '19:30' },
      ]),
    ).toEqual({ perWeek: 2, weeklyHours: 3 });
  });

  it('has no rhythm without slots', () => {
    expect(weeklyRhythm([])).toEqual({ perWeek: 0, weeklyHours: 0 });
  });
});

describe('nextSession', () => {
  it('is the earliest still-planned session, whatever its plan position', () => {
    const sessions = [
      session({ id: 'late', date: '2026-10-05', planIndex: 1 }),
      session({ id: 'early', date: '2026-09-25', planIndex: 7 }),
      session({ id: 'done', date: '2026-09-01', status: 'held' }),
    ];
    expect(nextSession(sessions)?.id).toBe('early');
  });

  it('is nothing once the course is over', () => {
    expect(nextSession([session({ date: '2026-09-01', status: 'held' })])).toBeNull();
  });

  it('skips a cancelled session — it is not coming', () => {
    const sessions = [
      session({ id: 'off', date: '2026-09-25', status: 'cancelled' }),
      session({ id: 'on', date: '2026-09-28' }),
    ];
    expect(nextSession(sessions)?.id).toBe('on');
  });
});

describe('isSubstitute', () => {
  it('is cover when somebody outside the group taught it', () => {
    expect(
      isSubstitute(session({ date: '2026-09-01', status: 'held', teacherId: 'ivan' }), STAFF),
    ).toBe(true);
  });

  it('is not cover for the group’s own teachers', () => {
    expect(
      isSubstitute(session({ date: '2026-09-01', status: 'held', teacherId: 'tom' }), STAFF),
    ).toBe(false);
  });

  it('is not cover before it happened — a future teacher is only pencilled in', () => {
    expect(isSubstitute(session({ date: '2026-10-01', teacherId: 'ivan' }), STAFF)).toBe(false);
  });
});

describe('stateOf', () => {
  const next = session({ id: 'next', date: '2026-09-25' });

  it.each([
    ['cancelled', session({ date: '2026-09-01', status: 'cancelled' }), 'cancelled'],
    ['held', session({ date: '2026-09-01', status: 'held' }), 'held'],
    ['covered', session({ date: '2026-09-01', status: 'held', teacherId: 'ivan' }), 'sub'],
    ['next', next, 'next'],
    ['planned', session({ date: '2026-10-30' }), 'planned'],
  ])('reads a %s session as %s', (_label, input, expected) => {
    expect(stateOf(input, STAFF, next)).toBe(expected);
  });

  it('keeps cancelled ahead of next — a called-off session is not what comes next', () => {
    const off = session({ id: 'off', date: '2026-09-25', status: 'cancelled' });
    expect(stateOf(off, STAFF, off)).toBe('cancelled');
  });
});

describe('weekOf', () => {
  it('counts weeks from the first actual date', () => {
    expect(weekOf(session({ date: '2026-09-07' }), '2026-09-07')).toBe(1);
    expect(weekOf(session({ date: '2026-09-13' }), '2026-09-07')).toBe(1);
    expect(weekOf(session({ date: '2026-09-14' }), '2026-09-07')).toBe(2);
  });

  it('moves a session to another week when it is rescheduled there', () => {
    expect(weekOf(session({ date: '2026-09-28' }), '2026-09-07')).toBe(4);
  });
});

describe('courseSpan', () => {
  const COURSE = [
    session({ date: '2026-09-07', status: 'held' }),
    session({ date: '2026-09-14', status: 'held' }),
    session({ date: '2026-09-21' }),
    session({ date: '2026-10-05' }),
  ];

  it('places the group in the week today falls in, however far behind it is', () => {
    expect(courseSpan(COURSE, '2026-09-23')).toEqual({
      firstDate: '2026-09-07',
      lastDate: '2026-10-05',
      // Two sessions delivered, but the calendar is in week three either way.
      currentWeek: 3,
      totalWeeks: 5,
      done: 2,
      total: 4,
      pct: 50,
    });
  });

  it('is in no week at all before the course starts', () => {
    expect(courseSpan(COURSE, '2026-08-30').currentWeek).toBe(0);
  });

  it('stays in the last week once the course is over', () => {
    expect(courseSpan(COURSE, '2027-01-01').currentWeek).toBe(5);
  });

  it('says nothing rather than dividing by zero on an empty course', () => {
    expect(courseSpan([])).toMatchObject({ firstDate: null, totalWeeks: 0, pct: 0 });
  });
});

describe('deliveryStats', () => {
  it('averages turnout over held lessons only', () => {
    const stats = deliveryStats(
      [
        session({ date: '2026-09-01', status: 'held', attendance: 12 }),
        session({ date: '2026-09-03', status: 'held', attendance: 10 }),
        // An exam: no turnout of its own, and it must not count as zero.
        session({ date: '2026-09-05', status: 'held', type: 'exam', attendance: null }),
        session({ date: '2026-09-08', status: 'cancelled' }),
        session({ date: '2026-10-01' }),
      ],
      STAFF,
      TODAY,
    );

    expect(stats).toMatchObject({ held: 3, cancelled: 1, averageAttendance: 11 });
  });

  it('reports no average when nothing has been recorded', () => {
    expect(
      deliveryStats([session({ date: '2026-10-01' })], STAFF, TODAY).averageAttendance,
    ).toBeNull();
  });

  it('counts a missing topic only once the session has come round', () => {
    const stats = deliveryStats(
      [
        session({ date: '2026-09-01', contentUnitId: null, contentLessonId: null }),
        session({ date: '2026-12-01', contentUnitId: null, contentLessonId: null }),
        session({
          date: '2026-09-02',
          contentUnitId: null,
          contentLessonId: null,
          status: 'cancelled',
        }),
      ],
      STAFF,
      TODAY,
    );

    expect(stats.withoutTopic).toBe(1);
  });

  it('counts cover separately from ordinary delivery', () => {
    const stats = deliveryStats(
      [
        session({ date: '2026-09-01', status: 'held' }),
        session({ date: '2026-09-03', status: 'held', teacherId: 'ivan' }),
      ],
      STAFF,
      TODAY,
    );

    expect(stats).toMatchObject({ held: 2, substituted: 1 });
  });
});

describe('examStats', () => {
  it('ignores ungraded students in both the average and the pass count', () => {
    expect(
      examStats(
        [
          { studentId: 'a', score: 90 },
          { studentId: 'b', score: 50 },
          { studentId: 'c', score: null },
        ],
        60,
      ),
    ).toEqual({ average: 70, graded: 2, passed: 1 });
  });

  it('has no average before anything is entered', () => {
    expect(examStats([{ studentId: 'a', score: null }], 60)).toEqual({
      average: null,
      graded: 0,
      passed: 0,
    });
  });

  it('passes at the mark itself, not above it', () => {
    expect(examStats([{ studentId: 'a', score: 60 }], 60).passed).toBe(1);
  });

  it('follows the school’s mark rather than a fixed 60', () => {
    expect(examStats([{ studentId: 'a', score: 60 }], 65).passed).toBe(0);
  });
});

describe('gradeTone', () => {
  it.each([
    [92, 'success'],
    [85, 'success'],
    [70, 'primary'],
    [60, 'primary'],
    [50, 'warn'],
    [45, 'warn'],
    [30, 'danger'],
  ])('reads %i as %s', (score, tone) => {
    expect(gradeTone(score)).toBe(tone);
  });
});

describe('whoTaught', () => {
  it('ranks by sessions delivered and marks who is the group’s own', () => {
    const shares = whoTaught(
      [
        session({ date: '2026-09-01', status: 'held' }),
        session({ date: '2026-09-03', status: 'held' }),
        session({ date: '2026-09-05', status: 'held' }),
        session({ date: '2026-09-08', status: 'held', teacherId: 'ivan' }),
        // Neither a planned session nor an unassigned one belongs to anybody.
        session({ date: '2026-10-01' }),
        session({ date: '2026-09-10', status: 'held', teacherId: null }),
      ],
      STAFF,
    );

    expect(shares).toEqual([
      { teacherId: 'maria', delivered: 3, pct: 75, isPrimary: true },
      { teacherId: 'ivan', delivered: 1, pct: 25, isPrimary: false },
    ]);
  });
});

describe('coverageByUnit', () => {
  it('counts what was held, and leaves a cancelled topic untaught', () => {
    expect(
      coverageByUnit([
        session({ date: '2026-09-01', status: 'held', contentUnitId: 'u1' }),
        session({ date: '2026-09-03', status: 'held', contentUnitId: 'u1' }),
        session({ date: '2026-09-05', status: 'cancelled', contentUnitId: 'u2' }),
        session({ date: '2026-09-08', contentUnitId: 'u2' }),
        session({ date: '2026-09-10', contentUnitId: null }),
      ]),
    ).toEqual([
      { contentUnitId: 'u1', taught: 2, planned: 2, state: 'done' },
      { contentUnitId: 'u2', taught: 0, planned: 2, state: 'untouched' },
    ]);
  });

  it('calls a partly taught unit in progress', () => {
    expect(
      coverageByUnit([
        session({ date: '2026-09-01', status: 'held', contentUnitId: 'u1' }),
        session({ date: '2026-09-03', contentUnitId: 'u1' }),
      ])[0],
    ).toMatchObject({ state: 'in-progress' });
  });
});

describe('filterLog', () => {
  const sessions = [
    session({ id: 'held', date: '2026-09-01', status: 'held' }),
    session({ id: 'covered', date: '2026-09-03', status: 'held', teacherId: 'ivan' }),
    session({ id: 'off', date: '2026-09-05', status: 'cancelled', note: 'Teacher ill' }),
    session({ id: 'no-topic', date: '2026-09-08', contentUnitId: null, contentLessonId: null }),
    session({
      id: 'exam-ungraded',
      date: '2026-09-10',
      status: 'held',
      type: 'exam',
      attendance: null,
    }),
    session({ id: 'next', date: '2026-09-25' }),
    session({ id: 'later', date: '2026-10-05' }),
    session({ id: 'exam-later', date: '2026-10-12', type: 'exam' }),
  ];

  it('reads the past newest first', () => {
    const rows = filterLog(sessions, 'recent', STAFF, TODAY);
    expect(rows.map((r) => r.id)).toEqual(['exam-ungraded', 'no-topic', 'off', 'covered', 'held']);
  });

  it('gathers only what is unfinished into issues', () => {
    const rows = filterLog(sessions, 'issues', STAFF, TODAY);
    expect(rows.map((r) => r.id)).toEqual(['exam-ungraded', 'no-topic', 'off', 'covered']);
  });

  it('lets a graded exam out of issues', () => {
    const graded = sessions.map((s) =>
      s.id === 'exam-ungraded' ? { ...s, scores: [{ studentId: 'a', score: 70 }] } : s,
    );
    expect(filterLog(graded, 'issues', STAFF, TODAY).map((r) => r.id)).not.toContain(
      'exam-ungraded',
    );
  });

  it('shows every exam, including ones still to come', () => {
    expect(filterLog(sessions, 'exams', STAFF, TODAY).map((r) => r.id)).toEqual([
      'exam-ungraded',
      'exam-later',
    ]);
  });

  it('shows what is coming in date order, and not what is cancelled', () => {
    expect(filterLog(sessions, 'upcoming', STAFF, TODAY).map((r) => r.id)).toEqual([
      'no-topic',
      'next',
      'later',
      'exam-later',
    ]);
  });
});

describe('timelineWeeks', () => {
  it('gives an empty week its own column, so a gap in the course still reads as a gap', () => {
    const weeks = timelineWeeks(
      [
        session({ id: 'a', date: '2026-09-01', status: 'held' }),
        // Nothing in week 2 — a break, not a shortening of the course.
        session({ id: 'b', date: '2026-09-15' }),
      ],
      STAFF,
    );

    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3]);
    expect(weeks[1]!.cells).toEqual([]);
    expect(weeks[2]!.cells.map((c) => c.session.id)).toEqual(['b']);
  });

  it('states each cell the way the log does', () => {
    const weeks = timelineWeeks(
      [
        session({ id: 'held', date: '2026-09-01', status: 'held' }),
        session({ id: 'cover', date: '2026-09-03', status: 'held', teacherId: 'nina' }),
        session({ id: 'next', date: '2026-09-08' }),
        session({ id: 'later', date: '2026-09-10' }),
      ],
      STAFF,
    );

    expect(weeks.flatMap((w) => w.cells).map((c) => c.state)).toEqual([
      'held',
      'sub',
      'next',
      'planned',
    ]);
  });

  it('has no strip at all without sessions', () => {
    expect(timelineWeeks([], STAFF)).toEqual([]);
  });
});

describe('topicOf', () => {
  const units = [
    {
      id: 'u1',
      title: 'Meetings',
      order: 2,
      items: [
        { id: 'l1', itemType: 'lesson', kind: 'text', title: 'Conditionals' },
        { id: 'l2', itemType: 'exercise', kind: null, title: 'Drill' },
      ],
    },
  ];

  it('names the item a session teaches', () => {
    expect(topicOf(session({ date: '2026-09-01' }), units)).toEqual({
      unitOrder: 2,
      unitTitle: 'Meetings',
      itemTitle: 'Conditionals',
      kind: 'text',
    });
  });

  it('names the unit alone when the session is pinned to a whole unit', () => {
    expect(topicOf(session({ date: '2026-09-01', contentLessonId: null }), units)).toEqual({
      unitOrder: 2,
      unitTitle: 'Meetings',
      itemTitle: null,
      kind: null,
    });
  });

  it('falls back to the item kind when it is not a lesson', () => {
    expect(topicOf(session({ date: '2026-09-01', contentLessonId: 'l2' }), units)?.kind).toBe(
      'exercise',
    );
  });

  it('finds the unit through the item when the session names no unit', () => {
    const found = topicOf(
      session({ date: '2026-09-01', contentUnitId: null, contentLessonId: 'l1' }),
      units,
    );
    expect(found?.unitTitle).toBe('Meetings');
  });

  it('says nothing about a session with no topic — a legal state, not an error', () => {
    expect(
      topicOf(session({ date: '2026-09-01', contentUnitId: null, contentLessonId: null }), units),
    ).toBeNull();
  });
});
