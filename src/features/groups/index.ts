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
export { TeacherAssignModal } from './components/teacher-assign-modal';
export { StudentAssignModal } from './components/student-assign-modal';
export type { TeacherAssignCandidate, StudentCandidate } from './api/queries';
export { GroupCreateFlow } from './components/group-create-flow';
export { SlotEditor } from './components/slot-editor';
export { useGroupCreateWizardStore } from './stores/create-wizard-store';
export { TeacherTimetable } from './components/teacher-timetable';
export { TimetableGrid } from './components/timetable-grid';
export { TeacherSelector } from './components/teacher-selector';

// The one form behind `POST /schools/:id/groups/:groupId/teachers` — review's
// oversight screen assigns a reviewer through it (plan 46 §46.7).
export { AssignTeacherForm } from './components/assign-teacher-form';
export type {
  AssignTeacherFormProps,
  AssignTeacherGroup,
  AssignTeacherOption,
} from './components/assign-teacher-form';
