export type NotificationKind =
  | 'enrollment_approved'
  | 'enrollment_rejected'
  | 'lesson_assigned'
  | 'new_material';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
}
