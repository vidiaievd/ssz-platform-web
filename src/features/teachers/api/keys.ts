export const teacherKeys = {
  all: (schoolId: string) => ['schools', schoolId, 'teachers'] as const,
  roster: (schoolId: string) => [...teacherKeys.all(schoolId), 'roster'] as const,
  detail: (schoolId: string, teacherId: string) =>
    [...teacherKeys.all(schoolId), 'detail', teacherId] as const,
  availability: (teacherId: string) => ['teachers', teacherId, 'availability'] as const,
  absences: (schoolId: string) => ['schools', schoolId, 'absences'] as const,
  commandCenter: (schoolId: string) =>
    ['schools', schoolId, 'scheduling', 'command-center'] as const,
  coverQueue: (schoolId: string) =>
    ['schools', schoolId, 'scheduling', 'substitutions'] as const,
  candidates: (requestId: string) =>
    ['scheduling', 'substitutions', requestId, 'candidates'] as const,
  curriculum: (groupId: string) => ['scheduling', 'curriculum', groupId] as const,
  forecast: (schoolId: string, scenarioId?: string) =>
    scenarioId
      ? (['schools', schoolId, 'scheduling', 'forecast', scenarioId] as const)
      : (['schools', schoolId, 'scheduling', 'forecast'] as const),
};
