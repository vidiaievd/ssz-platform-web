// Query keys (TanStack Query) and Next.js cache tags for groups.

export const groupKeys = {
  all: ['groups'] as const,
  list: (schoolId: string) => ['groups', 'list', schoolId] as const,
  detail: (schoolId: string, groupId: string) => ['groups', 'detail', schoolId, groupId] as const,
  teachers: (schoolId: string) => ['groups', 'teachers', schoolId] as const,
  timetable: (schoolId: string) => ['groups', 'timetable', schoolId] as const,
  conflicts: (schoolId: string) => ['groups', 'conflicts', schoolId] as const,
  studentCandidates: (schoolId: string, groupId: string) =>
    ['groups', 'candidates', schoolId, groupId] as const,
  schoolStudentCandidates: (schoolId: string) =>
    ['groups', 'school-students', schoolId] as const,
} as const;

// Next.js cache tags (used with revalidateTag / fetch next.tags)
export const groupCacheTags = {
  groups: (schoolId: string) => `groups:${schoolId}`,
  group: (groupId: string) => `group:${groupId}`,
  conflicts: (schoolId: string) => `conflicts:${schoolId}`,
  teachers: (schoolId: string) => `teachers:${schoolId}`,
} as const;
