export const studentKeys = {
  all: ['students'] as const,
  list: (schoolId: string, opts?: { segment?: string; search?: string }) =>
    ['students', 'list', schoolId, opts] as const,
  detail: (schoolId: string, userId: string) =>
    ['students', 'detail', schoolId, userId] as const,
  segments: (schoolId: string) => ['students', 'segments', schoolId] as const,
} as const;

export const studentCacheTags = {
  students: (schoolId: string) => `students:${schoolId}`,
  student: (userId: string) => `student:${userId}`,
  segments: (schoolId: string) => `segments:${schoolId}`,
} as const;
