export type NotificationType =
  | 'GENERAL'
  | 'WELCOME_EMAIL'
  | 'EMAIL_VERIFICATION'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'STUDY_REMINDER'
  | 'TEACHER_ABSENCE'
  | 'SUBSTITUTE_REQUEST'
  | 'SUBSTITUTE_ASSIGNED'
  | 'OVERLOAD_ALERT'
  | 'VACANCY_ALERT'
  | 'UNCOVERED_LESSON'
  | 'SCHOOL_INVITATION'
  | 'TEACHER_PROFILE_CHANGED'
  | 'ENROLLMENT_REQUEST'
  | 'ENROLLMENT_APPROVED'
  | 'ENROLLMENT_REJECTED'
  | 'PLACEMENT_REVIEW_READY'
  | 'GROUP_ASSIGNED'
  | 'ATTEMPT_REVIEWED'
  | 'REVIEW_DIGEST'
  | 'REVIEW_ESCALATION'
  | 'REVIEW_SCHOOL_SUMMARY';

export type NotificationCategory = 'Enrollment' | 'Staff' | 'Learning' | 'System';

export type NotificationFilter = 'all' | 'unread' | 'archived';

export type NotificationBulkAction = 'read' | 'unread' | 'archive' | 'unarchive' | 'delete';

export interface EnrollmentRequestData {
  membershipId: string;
  schoolId: string;
  schoolName: string;
  studentId: string;
  studentName: string;
  studentAvatarUrl?: string;
  studentEmail?: string;
  language?: string;
  ageBand?: string;
  source: string;
  occurredAt: string;
}

export interface TeacherProfileChangedData {
  teacherUserId: string;
  changedFields: string[];
  schoolId: string;
  occurredAt: string;
}

export interface EnrollmentApprovedData {
  membershipId: string;
  schoolId: string;
  schoolName: string;
  occurredAt: string;
}

export interface GroupAssignedData {
  membershipId: string;
  schoolId: string;
  schoolName: string;
  groupId: string;
  groupName: string;
  occurredAt: string;
}

export interface PlacementReviewReadyData {
  membershipId: string;
  schoolId: string;
  schoolName: string;
  studentId: string;
  occurredAt: string;
}

/**
 * A teacher has marked a submission — plan 42.
 *
 * `score` and `comment` are both nullable and mean different things when absent: no score
 * is work sent back rather than marked, and no comment is a teacher who had nothing to
 * add. Neither is a reason to withhold the notification — silence after handing work in
 * is what the marking queue exists to end.
 */
export interface AttemptReviewedData {
  attemptId: string;
  exerciseId: string;
  templateCode: string;
  outcome: 'approved' | 'returned';
  score: number | null;
  comment: string | null;
  /**
   * A person wrote something, anywhere — overall or on a single sentence (47.4).
   *
   * Not the same question as `comment !== null`, and the difference is what separates
   * "marked, nothing to add" from "marked, go and look". Optional because messages
   * written before the field existed are still in learners' lists.
   */
  hasComment?: boolean;
  approvedItems: number;
  totalItems: number;
  /** The course the work belongs to, as snapshotted on the attempt. */
  containerId?: string | null;
  /** Course · lesson · exercise as they read when the work was started. */
  exercisePath?: { course: string; module: string | null; exercise: string | null } | null;
  occurredAt: string;
}

/**
 * The teacher's side of the marking queue, on a timer (plan 47.5).
 *
 * One message per run rather than one per submission: a learner who hands in a lesson's
 * worth of exercises at one sitting must not produce twelve (criterion 41). `groups`
 * carries ids and counts — the names live on the inbox this links to, and copying them
 * into a message would be one more thing to go stale.
 */
export interface ReviewDigestData {
  schoolId: string;
  pending: number;
  groups: { groupId: string; pending: number }[];
  oldestSubmittedAt: string;
}

/** The same queue, past what the school itself promised (44.12). */
export interface ReviewEscalationData {
  schoolId: string;
  overdue: number;
  oldestSubmittedAt: string;
  escalateAfterHours: number;
  /**
   * `'school'` on the copy sent to whoever the school named in `escalateTo` — the same
   * lateness, but somebody else's problem to solve: theirs is to find a second marker,
   * not to mark. Absent on a teacher's own escalation (plan 47.5).
   */
  scope?: 'school';
  target?: string;
}

/**
 * The school's marking, once a week, to whoever it named (plan 47.6).
 *
 * A different question from the digest: not "what should I mark today" but "is our
 * marking keeping up" — so it is sent even when nothing is late, and never when nothing
 * is waiting at all.
 */
export interface ReviewSchoolSummaryData {
  schoolId: string;
  pending: number;
  overdue: number;
  oldestAgeHours: number;
  oldestSubmittedAt: string;
}

export type NotificationTemplateData =
  | EnrollmentRequestData
  | TeacherProfileChangedData
  | EnrollmentApprovedData
  | GroupAssignedData
  | PlacementReviewReadyData
  | AttemptReviewedData
  | ReviewDigestData
  | ReviewEscalationData
  | ReviewSchoolSummaryData
  | Record<string, unknown>;

export interface Notification {
  id: string;
  type: NotificationType;
  templateData?: NotificationTemplateData;
  isRead: boolean;
  archivedAt?: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
  nextCursor?: string | null;
}
