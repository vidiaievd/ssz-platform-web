export const dashboardKeys = {
  all: ['dashboard'] as const,
  detail: (schoolId: string) => [...dashboardKeys.all, 'detail', schoolId] as const,
} as const;

// Next.js cache tags for targeted revalidation
export const dashboardCacheTags = {
  dashboard: (schoolId: string) => `dashboard:${schoolId}`,
  atRisk: (schoolId: string) => `at-risk:${schoolId}`,
  reviewQueue: (schoolId: string) => `review-queue:${schoolId}`,
  activity: (schoolId: string) => `activity:${schoolId}`,
  onboarding: (schoolId: string) => `onboarding:${schoolId}`,
} as const;
