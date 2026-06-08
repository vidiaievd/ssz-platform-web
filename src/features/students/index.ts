// Public API of the students feature.

export type {
  StudentStatus,
  StudentGroupRef,
  StudentListItem,
  StudentDetail,
  TeacherRef,
  SegmentKey,
  Segment,
  SegmentPredicate,
  EnrollBranch,
  EmailResolveResult,
  StudentsListResult,
} from './types';

export { studentKeys, studentCacheTags } from './api/keys';

export {
  enrollStudent,
  enrollStudents,
  addToGroup,
  removeFromGroup,
  nudgeStudent,
  bulkMessage,
  saveSegment,
} from './api/mutations';

export {
  enrollFormSchema,
  enrollEmailsSchema,
  saveSegmentSchema,
  bulkMessageSchema,
  type EnrollFormInput,
  type EnrollFormOutput,
  type SaveSegmentInput,
  type BulkMessageInput,
} from './schemas';
