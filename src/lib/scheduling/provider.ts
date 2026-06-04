import type { Slot, Lesson, TimetableTeacher, OpsWarning } from '@/features/groups/types';

export interface SchedulingProvider {
  getSlots(groupId: string): Promise<Slot[]>;
  putSlots(groupId: string, slots: Slot[]): Promise<void>;
  nextLessons(groupId: string, limit: number): Promise<Lesson[]>;
  teacherTimetable(schoolId: string): Promise<TimetableTeacher[]>;
  teacherConflicts(schoolId: string): Promise<OpsWarning[]>;
  studentClashes(schoolId: string, userId: string): Promise<OpsWarning[]>;
}

export function getSchedulingProvider(): SchedulingProvider {
  if (process.env.SCHEDULING_BACKEND === 'real') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./real').realProvider as SchedulingProvider;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./mock').mockProvider as SchedulingProvider;
}
