import type { CourseView, Group } from '../types';

/**
 * Pure mapper over Group fields — no new course-detail endpoint exists (spec §6.1).
 * Step 9 enriches this with a best-effort curriculum unit count.
 */
export function deriveCourseView(
  group: Pick<Group, 'courseId' | 'courseName' | 'lang' | 'level'>,
): CourseView {
  return {
    courseId: group.courseId,
    courseName: group.courseName ?? null,
    lang: group.lang,
    level: group.level,
    unitCount: null,
  };
}
