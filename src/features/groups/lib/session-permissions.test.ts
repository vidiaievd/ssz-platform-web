import { describe, expect, it } from 'vitest';

import { creatableTypes, sessionRights } from './session-permissions';
import type { Session } from '../types';

function session(teacherId: string | null): Session {
  return {
    id: 's1',
    groupId: 'g1',
    schoolId: 'sc1',
    slotId: null,
    date: '2026-09-01',
    start: '09:00',
    end: '10:30',
    teacherId,
    room: '',
    status: 'held',
    type: 'lesson',
    curriculumUnitId: null,
    contentUnitId: null,
    contentLessonId: null,
    attendance: null,
    note: null,
    extra: false,
    planIndex: 0,
    passMark: null,
    scores: [],
  };
}

const MANAGER = { canManage: true, userId: 'admin' };
const TEACHER = { canManage: false, userId: 'maria' };

describe('sessionRights', () => {
  it('lets a manager change everything, including a session they do not teach', () => {
    expect(sessionRights(MANAGER, session('maria'))).toEqual({
      canRecord: true,
      canReschedule: true,
      canChangeTeacher: true,
      canDelete: true,
    });
  });

  it('lets a teacher record their own session but not move it or reassign it', () => {
    expect(sessionRights(TEACHER, session('maria'))).toEqual({
      canRecord: true,
      canReschedule: false,
      canChangeTeacher: false,
      canDelete: false,
    });
  });

  it('gives a teacher nothing on somebody else’s session', () => {
    expect(sessionRights(TEACHER, session('tom')).canRecord).toBe(false);
  });

  it('treats an unassigned session as nobody’s', () => {
    expect(sessionRights(TEACHER, session(null)).canRecord).toBe(false);
  });

  it('gives a teacher nothing on a session that does not exist yet', () => {
    expect(sessionRights(TEACHER, null).canRecord).toBe(false);
  });
});

describe('creatableTypes', () => {
  it('lets a manager add any kind of session', () => {
    expect(creatableTypes(MANAGER)).toHaveLength(4);
  });

  it('limits a teacher to a make-up class', () => {
    expect(creatableTypes(TEACHER)).toEqual(['make_up']);
  });
});
