import { describe, expect, it } from 'vitest';

import type { GroupHealthItem, SchoolSessionItem } from '@/lib/dashboard/types';

import { buildTodaysClasses, utcDay } from './todays-classes';

const GROUP: GroupHealthItem = {
  id: 'g1',
  name: 'Norsk A2 · kveld',
  lang: 'nb',
  level: 'A2',
  primaryTeacherName: 'Kari',
  studentCount: 7,
  max: 12,
  alerts: [],
};

function session(over: Partial<SchoolSessionItem> = {}): SchoolSessionItem {
  return {
    id: 's1',
    groupId: 'g1',
    date: '2026-11-22',
    startTime: '18:00',
    endTime: '19:30',
    teacherId: 't1',
    room: null,
    status: 'scheduled',
    ...over,
  };
}

describe('buildTodaysClasses', () => {
  it('names a session by its group and counts the group', () => {
    const result = buildTodaysClasses([session()], [GROUP]);

    expect(result).toEqual({
      status: 'ok',
      data: [
        {
          id: 's1',
          time: '18:00',
          name: 'Norsk A2 · kveld',
          room: '',
          mode: 'online',
          students: 7,
          cap: 12,
          status: 'upcoming',
        },
      ],
    });
  });

  it('reads a session with a room as held in person', () => {
    const result = buildTodaysClasses([session({ room: ' 204 ' })], [GROUP]);

    expect(result.status === 'ok' && result.data[0]).toMatchObject({ mode: 'in-person', room: '204' });
  });

  it('orders the day by start time', () => {
    const result = buildTodaysClasses(
      [session({ id: 'late', startTime: '18:00' }), session({ id: 'early', startTime: '09:15' })],
      [GROUP],
    );

    expect(result.status === 'ok' && result.data.map((c) => c.id)).toEqual(['early', 'late']);
  });

  it('leaves cancelled sessions out, and a day of only those is empty', () => {
    expect(buildTodaysClasses([session({ status: 'cancelled' })], [GROUP])).toEqual({ status: 'empty' });
  });

  it('keeps moved and held sessions', () => {
    const result = buildTodaysClasses(
      [session({ id: 'm', status: 'moved' }), session({ id: 'h', status: 'held' })],
      [GROUP],
    );

    expect(result.status === 'ok' && result.data).toHaveLength(2);
  });

  it('still shows a session of a group the list lacks, unnamed and uncounted', () => {
    const result = buildTodaysClasses([session({ groupId: 'unknown' })], [GROUP]);

    expect(result.status === 'ok' && result.data[0]).toMatchObject({ name: null, students: 0, cap: null });
  });

  it('has no capacity for a group without a maximum', () => {
    const result = buildTodaysClasses([session()], [{ ...GROUP, max: 0 }]);

    expect(result.status === 'ok' && result.data[0]?.cap).toBeNull();
  });

  it('is empty on a day without sessions', () => {
    expect(buildTodaysClasses([], [GROUP])).toEqual({ status: 'empty' });
  });

  it('is unavailable when scheduling could not be read', () => {
    expect(buildTodaysClasses({ status: 'unavailable' }, [GROUP])).toEqual({ status: 'unavailable' });
  });
});

describe('utcDay', () => {
  it('is the UTC calendar day', () => {
    expect(utcDay(new Date('2026-11-22T23:30:00.000Z'))).toBe('2026-11-22');
  });
});
