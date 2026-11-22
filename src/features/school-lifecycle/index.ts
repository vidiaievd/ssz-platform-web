export { SchoolStatusBanner } from './components/school-status-banner';
export { SchoolNotActiveNotice } from './components/school-not-active-notice';
export { SchoolTaskLocked, type SchoolTaskLockedProps } from './components/school-task-locked';
export { MaintenanceBadge } from './components/maintenance-badge';
export { daysLeft } from './lib/days-left';
export { isObsoleteHistoryOnly } from './lib/obsolete-course';
export {
  isCourseObsolete,
  lifecycleErrorKey,
  lifecycleErrorKeyOf,
  schoolNotActiveStatus,
  schoolNotActiveResponseBody,
} from './lib/lifecycle-errors';
export type { MaintenanceStatus, SchoolLifecycleFields, SchoolLifecycleStatus } from './types';
export { COURSE_OBSOLETE, SCHOOL_NOT_ACTIVE } from './types';
export {
  ReadOnlyReason,
  SchoolWritableProvider,
  useSchoolStatus,
  useSchoolWritable,
  WritableOnly,
} from './components/school-writable';
