import 'server-only';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { NextClass, StudentSchool } from '../types/learning';
import { getStudentSchools } from './get-student-schools';

/**
 * scheduling-service `GET groups/:groupId/lessons/next`. Validated rather than
 * trusted: this feeds the Home screen, and a shape change upstream must degrade
 * to "no next class" instead of rendering `undefined · undefined`.
 */
const RawNextLesson = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  teacherId: z.string().nullish(),
  room: z.string().nullish(),
  status: z.string(),
});

const RawNextLessonList = z.array(RawNextLesson);

type RawNextLesson = z.infer<typeof RawNextLesson>;

/** `date` may arrive as a full ISO instant; the UI only ever shows the day. */
const toDay = (date: string): string => date.slice(0, 10);

/** `startTime`/`endTime` may carry seconds; the UI shows HH:MM. */
const toHHMM = (time: string): string => time.slice(0, 5);

/** Sortable instant, used to pick the soonest lesson across schools. */
function lessonKey(l: Pick<RawNextLesson, 'date' | 'startTime'>): string {
  return `${toDay(l.date)}T${toHHMM(l.startTime)}`;
}

/**
 * Best-effort teacher identity. The group's roster (already fetched) covers the
 * common case; only a teacher outside it — a substitute, typically — costs an
 * extra profile lookup, and an unresolved one degrades to `null` rather than
 * dropping the whole card.
 */
async function resolveTeacher(
  teacherId: string | null | undefined,
  school: StudentSchool,
): Promise<NextClass['teacher']> {
  if (!teacherId) return null;

  const known = school.teachers.find((t) => t.userId === teacherId);
  if (known) return { userId: known.userId, name: known.name, avatarUrl: known.avatarUrl };

  try {
    const profile = await serverFetch<{ displayName?: string; avatarUrl?: string | null }>({
      service: 'profile',
      path: `/profiles/${teacherId}`,
    });
    if (!profile?.displayName) return null;
    return { userId: teacherId, name: profile.displayName, avatarUrl: profile.avatarUrl ?? null };
  } catch {
    return null;
  }
}

async function nextLessonForSchool(
  school: StudentSchool,
): Promise<{ school: StudentSchool; lesson: RawNextLesson } | null> {
  if (!school.groupId) return null;

  try {
    const raw = await serverFetch({
      service: 'scheduling',
      path: `/scheduling/groups/${school.groupId}/lessons/next`,
      query: { limit: '1' },
    });
    const parsed = RawNextLessonList.safeParse(raw);
    if (!parsed.success) return null;

    const lesson = parsed.data[0];
    return lesson ? { school, lesson } : null;
  } catch {
    // scheduling-service down or the group has no timetable — Home still renders.
    return null;
  }
}

/**
 * The soonest upcoming class across every active school membership, or `null`
 * when the student has none. Every upstream call is individually degradable:
 * this endpoint must never be the reason the Home screen fails.
 */
export async function getNextClass(
  myUserId: string,
  /** Pass an already-fetched list to avoid re-running the school aggregate. */
  prefetchedSchools?: StudentSchool[],
): Promise<NextClass | null> {
  let schools: StudentSchool[];
  try {
    schools = prefetchedSchools ?? (await getStudentSchools(myUserId));
  } catch {
    return null;
  }

  const withGroup = schools.filter((s) => s.status === 'active' && s.groupId);
  if (!withGroup.length) return null;

  const results = await Promise.all(withGroup.map(nextLessonForSchool));
  const found = results.filter((r): r is NonNullable<typeof r> => r !== null);
  if (!found.length) return null;

  const soonest = found.reduce((a, b) => (lessonKey(a.lesson) <= lessonKey(b.lesson) ? a : b));
  const { school, lesson } = soonest;

  return {
    lessonId: lesson.id,
    date: toDay(lesson.date),
    startTime: toHHMM(lesson.startTime),
    endTime: toHHMM(lesson.endTime),
    room: lesson.room ?? null,
    status: lesson.status,
    schoolId: school.schoolId,
    schoolSlug: school.schoolSlug,
    schoolName: school.schoolName,
    groupId: school.groupId!,
    groupName: school.groupName ?? '',
    teacher: await resolveTeacher(lesson.teacherId, school),
  };
}
