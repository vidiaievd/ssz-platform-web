// Public API of the groups feature.
// UI components are added here as they are built in phases 2–7.

export type {
  Group,
  GroupHealthRowVM,
  GroupTeacher,
  GroupStatus,
  GroupMode,
  TeacherRole,
  RosterStudent,
  Slot,
  Substitution,
  Lesson,
  TimetableTeacher,
  OpsWarning,
  MutationResult,
  LangCode,
  CEFR,
  Weekday,
  HHMM,
  ISODate,
} from './types';

export { groupKeys, groupCacheTags } from './api/keys';

export {
  createGroup,
  updateGroup,
  deleteGroup,
  publishGroup,
  archiveGroup,
  assignTeacher,
  removeTeacher,
  addStudents,
  removeStudent,
  updateSlots,
} from './api/mutations';

export {
  groupCreateSchema,
  slotSchema,
  teacherAssignSchema,
  type GroupCreateInput,
  type SlotInput,
  type TeacherAssignInput,
} from './schemas';

export { GroupsList } from './components/groups-list';
export { GroupHealthRow } from './components/group-health-row';
export { GroupStatusPill } from './components/group-status-pill';
export { GroupListFilters } from './components/group-list-filters';
export { GroupDetail } from './components/group-detail';
export { GroupResolveBanner } from './components/group-resolve-banner';
export { GroupTabs } from './components/group-tabs';
export { TeacherRow } from './components/teacher-row';
export { filterGroups, attentionCount } from './lib/filter-groups';
export type { GroupFilter, Segment, SortKey } from './lib/filter-groups';
export { duplicateGroup } from './api/mutations';
