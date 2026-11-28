// Public API of the dashboard feature.
// Cross-feature imports must go through this barrel only.

export type {
  DashboardRole,
  DataState,
  SchoolType,
  Trend,
  WidgetData,
  Kpi,
  ActivityItem,
  CourseHealthRow,
  AtRiskStudent,
  TodaysClass,
  OnboardingItem,
  OnboardingState,
  DashboardData,
  NavId,
  WidgetId,
  QuickAction,
} from './types';

export { kpiSetFor, quickActionsFor, canSeeWidget, navGating } from './lib/roles';
export { deriveSchoolType, deriveDataState, deriveViewerRole, computeOnboarding } from './lib/derive';
export { dashboardKeys, dashboardCacheTags } from './api/keys';
export { nudgeAtRiskStudents } from './api/nudge-at-risk';

