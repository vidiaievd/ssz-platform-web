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
  | 'ATTEMPT_REVIEWED';

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
  approvedItems: number;
  totalItems: number;
  occurredAt: string;
}

export type NotificationTemplateData =
  | EnrollmentRequestData
  | TeacherProfileChangedData
  | EnrollmentApprovedData
  | GroupAssignedData
  | PlacementReviewReadyData
  | AttemptReviewedData
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
