export type NotificationType =
  | 'ENROLLMENT_APPROVED'
  | 'ENROLLMENT_REJECTED'
  | 'LESSON_ASSIGNED'
  | 'NEW_MATERIAL'
  | 'TEACHER_PROFILE_CHANGED';

export interface TeacherProfileChangedData {
  teacherUserId: string;
  changedFields: string[];
  schoolId: string;
  occurredAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  templateData?: TeacherProfileChangedData | Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
  nextCursor?: string;
}
