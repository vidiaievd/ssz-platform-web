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
  | 'GROUP_ASSIGNED';

export type NotificationCategory = 'Enrollment' | 'Staff' | 'System';

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

export type NotificationTemplateData =
  | EnrollmentRequestData
  | TeacherProfileChangedData
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
