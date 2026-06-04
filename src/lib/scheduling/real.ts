/**
 * Real scheduling provider — forwards to /api/scheduling/* BFF routes.
 * Enabled via SCHEDULING_BACKEND=real env flag once scheduling-service is ready.
 * See backend-todo.md §3.
 */

import type { SchedulingProvider } from './provider';

export const realProvider: SchedulingProvider = {
  async getSlots(_groupId: string) {
    throw new Error('scheduling-service not ready');
  },
  async putSlots(_groupId: string, _slots: unknown[]) {
    throw new Error('scheduling-service not ready');
  },
  async nextLessons(_groupId: string, _limit: number) {
    throw new Error('scheduling-service not ready');
  },
  async teacherTimetable(_schoolId: string) {
    throw new Error('scheduling-service not ready');
  },
  async teacherConflicts(_schoolId: string) {
    throw new Error('scheduling-service not ready');
  },
  async studentClashes(_schoolId: string, _userId: string) {
    throw new Error('scheduling-service not ready');
  },
};
