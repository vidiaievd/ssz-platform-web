/**
 * Deterministic fixture data for the mock scheduling provider.
 * Reused by unit and integration tests.
 */

import type { Slot } from '@/features/groups/types';

// group-id → weekly slots
export const FIXTURE_SLOTS: Record<string, Slot[]> = {
  'group-a1': [
    { id: 'slot-a1-1', day: 'Mon', start: '18:00', end: '19:30', room: 'Room 1' },
    { id: 'slot-a1-2', day: 'Wed', start: '18:00', end: '19:30', room: 'Room 1' },
  ],
  'group-b1': [
    // Conflicts with group-a1 on Mon 18:00–19:30 (same teacher-id: teacher-x)
    { id: 'slot-b1-1', day: 'Mon', start: '18:30', end: '20:00', room: 'Room 2' },
    { id: 'slot-b1-2', day: 'Fri', start: '10:00', end: '11:30', room: 'Room 2' },
  ],
  'group-c2': [
    { id: 'slot-c2-1', day: 'Tue', start: '09:00', end: '10:30', room: 'Online' },
    { id: 'slot-c2-2', day: 'Thu', start: '09:00', end: '10:30', room: 'Online' },
  ],
  // overloaded teacher: group-d1 + group-e1 together exceed maxWeeklyHours=8
  'group-d1': [
    { id: 'slot-d1-1', day: 'Mon', start: '08:00', end: '10:00', room: 'Room 3' },
    { id: 'slot-d1-2', day: 'Tue', start: '08:00', end: '10:00', room: 'Room 3' },
    { id: 'slot-d1-3', day: 'Wed', start: '08:00', end: '10:00', room: 'Room 3' },
  ],
  'group-e1': [
    { id: 'slot-e1-1', day: 'Thu', start: '08:00', end: '10:00', room: 'Room 3' },
    { id: 'slot-e1-2', day: 'Fri', start: '08:00', end: '10:00', room: 'Room 3' },
  ],
};

export const FIXTURE_DEFAULT_SLOTS: Slot[] = [];

// teacher-id → maxWeeklyHours
export const FIXTURE_TEACHER_MAX_HOURS: Record<string, number> = {
  'teacher-x': 10,  // has conflict between group-a1 and group-b1
  'teacher-y': 8,   // overloaded by group-d1 + group-e1 (10h total)
  'teacher-z': 20,
};

// teacher-id → name + avatar
export const FIXTURE_TEACHER_META: Record<string, { name: string; avatarUrl: string | null }> = {
  'teacher-x': { name: 'Alex Teacher', avatarUrl: null },
  'teacher-y': { name: 'Bo Teacher', avatarUrl: null },
  'teacher-z': { name: 'Cara Teacher', avatarUrl: null },
};

// school-id → teacher ids active in that school
export const FIXTURE_SCHOOL_TEACHERS: Record<string, string[]> = {
  'school-1': ['teacher-x', 'teacher-y', 'teacher-z'],
};

// group-id → { primaryTeacherId, coPrimaryTeacherId, studentCount, capacity, status }
export const FIXTURE_GROUP_META: Record<string, {
  primaryTeacherId: string | null;
  coPrimaryTeacherId: string | null;
  studentCount: number;
  capacity: { min: number; max: number };
  status: 'draft' | 'active' | 'archived';
  name: string;
  lang: string;
  startDate: string | null;
  endDate: string | null;
}> = {
  'group-a1': {
    primaryTeacherId: 'teacher-x',
    coPrimaryTeacherId: null,
    studentCount: 8,
    capacity: { min: 5, max: 12 },
    status: 'active',
    name: 'English A1 Morning',
    lang: 'en',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
  },
  'group-b1': {
    primaryTeacherId: 'teacher-x', // same teacher → conflict with group-a1 on Mon
    coPrimaryTeacherId: null,
    studentCount: 3,
    capacity: { min: 5, max: 10 },
    status: 'active',
    name: 'Norwegian B1 Evening',
    lang: 'nb',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
  },
  'group-c2': {
    primaryTeacherId: 'teacher-z',
    coPrimaryTeacherId: null,
    studentCount: 10,
    capacity: { min: 5, max: 10 }, // over capacity
    status: 'active',
    name: 'Ukrainian C2 Online',
    lang: 'uk',
    startDate: '2026-02-01',
    endDate: '2026-07-31',
  },
  'group-d1': {
    primaryTeacherId: 'teacher-y',
    coPrimaryTeacherId: null,
    studentCount: 6,
    capacity: { min: 4, max: 12 },
    status: 'active',
    name: 'German D1 Intensive',
    lang: 'de',
    startDate: '2026-01-15',
    endDate: '2026-06-30',
  },
  'group-e1': {
    primaryTeacherId: 'teacher-y', // same teacher as d1 → overload
    coPrimaryTeacherId: null,
    studentCount: 5,
    capacity: { min: 4, max: 10 },
    status: 'active',
    name: 'French E1 Basics',
    lang: 'fr',
    startDate: '2026-01-15',
    endDate: '2026-06-30',
  },
};
