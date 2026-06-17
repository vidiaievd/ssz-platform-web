/**
 * Real scheduling provider — forwards to /api/scheduling/* BFF routes.
 * Enabled via SCHEDULING_BACKEND=real env flag once scheduling-service is ready.
 * See backend-todo.md §3.
 */

import { AppError } from '@/lib/errors';
import type { SchedulingProvider } from './provider';

const notReady = () => new AppError('upstream_unavailable', 'scheduling-service not ready');

export const realProvider: SchedulingProvider = {
  async getSlots(_groupId: string) { throw notReady(); },
  async putSlots(_groupId: string, _slots: unknown[]) { throw notReady(); },
  async nextLessons(_groupId: string, _limit: number) { throw notReady(); },
  async teacherTimetable(_schoolId: string) { throw notReady(); },
  async teacherConflicts(_schoolId: string) { throw notReady(); },
  async studentClashes(_schoolId: string, _userId: string) { throw notReady(); },
  async commandCenter(_schoolId: string) { throw notReady(); },
  async getAvailability(_teacherId: string) { throw notReady(); },
  async putAvailability(_teacherId: string, _blocks: unknown[]) { throw notReady(); },
  async listAbsences(_schoolId: string) { throw notReady(); },
  async reportAbsence(_input: unknown) { throw notReady(); },
  async coverQueue(_schoolId: string) { throw notReady(); },
  async candidates(_requestId: string) { throw notReady(); },
  async assignSubstitute(_requestId: string, _substituteTeacherId: string) { throw notReady(); },
  async getCurriculum(_groupId: string) { throw notReady(); },
  async putCurriculum(_groupId: string, _plan: unknown) { throw notReady(); },
  async computeForecast(_schoolId: string, _params: unknown) { throw notReady(); },
};
