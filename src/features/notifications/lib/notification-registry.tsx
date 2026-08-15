import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarOff,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  Mail,
  type LucideIcon,
  UserCheck,
  UserCog,
  UserPlus,
  UserSearch,
  Users,
  XCircle,
} from 'lucide-react';
import type { useTranslations } from 'next-intl';

import type {
  AttemptReviewedData,
  EnrollmentApprovedData,
  EnrollmentRequestData,
  GroupAssignedData,
  NotificationCategory,
  NotificationTemplateData,
  NotificationType,
  PlacementReviewReadyData,
  TeacherProfileChangedData,
} from '../types';

export type NotificationsTranslator = ReturnType<typeof useTranslations<'Notifications'>>;

export interface NotificationLinkContext {
  workspaceKind: 'school' | 'student';
  schoolSlug?: string;
}

export interface NotificationRegistryEntry {
  icon: LucideIcon;
  category: NotificationCategory;
  priority: 'high' | 'normal';
  actionable: boolean;
  resolveTitle: (data: NotificationTemplateData | undefined, t: NotificationsTranslator) => string;
  resolveBody: (data: NotificationTemplateData | undefined, t: NotificationsTranslator) => string;
  getLink: (
    data: NotificationTemplateData | undefined,
    ctx: NotificationLinkContext,
  ) => string | undefined;
}

export function isEnrollmentRequestData(data: unknown): data is EnrollmentRequestData {
  return !!data && typeof data === 'object' && 'studentId' in data && 'membershipId' in data;
}

function isTeacherProfileChangedData(data: unknown): data is TeacherProfileChangedData {
  return !!data && typeof data === 'object' && 'teacherUserId' in data;
}

function isEnrollmentApprovedData(data: unknown): data is EnrollmentApprovedData {
  return !!data && typeof data === 'object' && 'schoolId' in data && !('groupId' in data);
}

function isGroupAssignedData(data: unknown): data is GroupAssignedData {
  return !!data && typeof data === 'object' && 'groupId' in data && 'groupName' in data;
}

function isPlacementReviewReadyData(data: unknown): data is PlacementReviewReadyData {
  return !!data && typeof data === 'object' && 'schoolId' in data && 'studentId' in data;
}

function isAttemptReviewedData(data: unknown): data is AttemptReviewedData {
  return !!data && typeof data === 'object' && 'attemptId' in data && 'outcome' in data;
}

const noLink: NotificationRegistryEntry['getLink'] = () => undefined;

export const notificationRegistry: Record<NotificationType, NotificationRegistryEntry> = {
  GENERAL: {
    icon: Bell,
    category: 'System',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.GENERAL.title'),
    resolveBody: (_data, t) => t('types.GENERAL.body'),
    getLink: noLink,
  },
  WELCOME_EMAIL: {
    icon: Mail,
    category: 'System',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.WELCOME_EMAIL.title'),
    resolveBody: (_data, t) => t('types.WELCOME_EMAIL.body'),
    getLink: noLink,
  },
  EMAIL_VERIFICATION: {
    icon: Mail,
    category: 'System',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.EMAIL_VERIFICATION.title'),
    resolveBody: (_data, t) => t('types.EMAIL_VERIFICATION.body'),
    getLink: noLink,
  },
  PASSWORD_RESET: {
    icon: KeyRound,
    category: 'System',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.PASSWORD_RESET.title'),
    resolveBody: (_data, t) => t('types.PASSWORD_RESET.body'),
    getLink: noLink,
  },
  PASSWORD_CHANGED: {
    icon: KeyRound,
    category: 'System',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.PASSWORD_CHANGED.title'),
    resolveBody: (_data, t) => t('types.PASSWORD_CHANGED.body'),
    getLink: noLink,
  },
  STUDY_REMINDER: {
    icon: Bell,
    category: 'System',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.STUDY_REMINDER.title'),
    resolveBody: (_data, t) => t('types.STUDY_REMINDER.body'),
    getLink: noLink,
  },
  TEACHER_ABSENCE: {
    icon: CalendarOff,
    category: 'Staff',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.TEACHER_ABSENCE.title'),
    resolveBody: (_data, t) => t('types.TEACHER_ABSENCE.body'),
    getLink: noLink,
  },
  SUBSTITUTE_REQUEST: {
    icon: UserSearch,
    category: 'Staff',
    priority: 'high',
    actionable: false,
    resolveTitle: (_data, t) => t('types.SUBSTITUTE_REQUEST.title'),
    resolveBody: (_data, t) => t('types.SUBSTITUTE_REQUEST.body'),
    getLink: noLink,
  },
  SUBSTITUTE_ASSIGNED: {
    icon: UserCheck,
    category: 'Staff',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.SUBSTITUTE_ASSIGNED.title'),
    resolveBody: (_data, t) => t('types.SUBSTITUTE_ASSIGNED.body'),
    getLink: noLink,
  },
  OVERLOAD_ALERT: {
    icon: AlertTriangle,
    category: 'Staff',
    priority: 'high',
    actionable: false,
    resolveTitle: (_data, t) => t('types.OVERLOAD_ALERT.title'),
    resolveBody: (_data, t) => t('types.OVERLOAD_ALERT.body'),
    getLink: noLink,
  },
  VACANCY_ALERT: {
    icon: AlertCircle,
    category: 'Staff',
    priority: 'high',
    actionable: false,
    resolveTitle: (_data, t) => t('types.VACANCY_ALERT.title'),
    resolveBody: (_data, t) => t('types.VACANCY_ALERT.body'),
    getLink: noLink,
  },
  UNCOVERED_LESSON: {
    icon: CalendarX,
    category: 'Staff',
    priority: 'high',
    actionable: false,
    resolveTitle: (_data, t) => t('types.UNCOVERED_LESSON.title'),
    resolveBody: (_data, t) => t('types.UNCOVERED_LESSON.body'),
    getLink: noLink,
  },
  SCHOOL_INVITATION: {
    icon: Mail,
    category: 'Staff',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.SCHOOL_INVITATION.title'),
    resolveBody: (_data, t) => t('types.SCHOOL_INVITATION.body'),
    getLink: noLink,
  },
  TEACHER_PROFILE_CHANGED: {
    icon: UserCog,
    category: 'Staff',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.TEACHER_PROFILE_CHANGED.title'),
    resolveBody: (_data, t) => t('types.TEACHER_PROFILE_CHANGED.body'),
    getLink: (data, ctx) => {
      if (ctx.workspaceKind !== 'school' || !ctx.schoolSlug) return undefined;
      if (!isTeacherProfileChangedData(data)) return undefined;
      return `/school/${ctx.schoolSlug}/teachers/${data.teacherUserId}`;
    },
  },
  ENROLLMENT_REQUEST: {
    icon: UserPlus,
    category: 'Enrollment',
    priority: 'high',
    actionable: true,
    resolveTitle: (data, t) =>
      isEnrollmentRequestData(data)
        ? t('types.ENROLLMENT_REQUEST.title', { studentName: data.studentName })
        : t('types.ENROLLMENT_REQUEST.titleFallback'),
    resolveBody: (data, t) =>
      isEnrollmentRequestData(data)
        ? t('types.ENROLLMENT_REQUEST.body', { schoolName: data.schoolName })
        : '',
    getLink: (_data, ctx) => {
      if (ctx.workspaceKind !== 'school' || !ctx.schoolSlug) return undefined;
      return `/school/${ctx.schoolSlug}/enrollment/requests`;
    },
  },
  ENROLLMENT_APPROVED: {
    icon: CheckCircle2,
    category: 'Enrollment',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.ENROLLMENT_APPROVED.title'),
    resolveBody: (data, t) =>
      isEnrollmentApprovedData(data)
        ? t('types.ENROLLMENT_APPROVED.body', { school: data.schoolName })
        : t('types.ENROLLMENT_APPROVED.bodyFallback'),
    getLink: (data, ctx) =>
      ctx.workspaceKind === 'student' && isEnrollmentApprovedData(data)
        ? `/student/dashboard#school-${data.schoolId}`
        : undefined,
  },
  ENROLLMENT_REJECTED: {
    icon: XCircle,
    category: 'Enrollment',
    priority: 'normal',
    actionable: false,
    resolveTitle: (_data, t) => t('types.ENROLLMENT_REJECTED.title'),
    resolveBody: (_data, t) => t('types.ENROLLMENT_REJECTED.body'),
    getLink: noLink,
  },
  PLACEMENT_REVIEW_READY: {
    icon: ClipboardCheck,
    category: 'Enrollment',
    priority: 'normal',
    actionable: true,
    resolveTitle: (_data, t) => t('types.PLACEMENT_REVIEW_READY.title'),
    resolveBody: (data, t) =>
      isPlacementReviewReadyData(data)
        ? t('types.PLACEMENT_REVIEW_READY.body', { school: data.schoolName })
        : t('types.PLACEMENT_REVIEW_READY.bodyFallback'),
    getLink: (_data, ctx) =>
      ctx.workspaceKind === 'school' && ctx.schoolSlug ? `/school/${ctx.schoolSlug}/enrollment/placement` : undefined,
  },
  GROUP_ASSIGNED: {
    icon: Users,
    category: 'Enrollment',
    priority: 'normal',
    actionable: false,
    resolveTitle: (data, t) =>
      isGroupAssignedData(data) ? t('types.GROUP_ASSIGNED.title', { group: data.groupName }) : t('types.GROUP_ASSIGNED.titleFallback'),
    resolveBody: (data, t) =>
      isGroupAssignedData(data)
        ? t('types.GROUP_ASSIGNED.body', { group: data.groupName, school: data.schoolName })
        : t('types.GROUP_ASSIGNED.bodyFallback'),
    getLink: (data, ctx) =>
      ctx.workspaceKind === 'student' && isGroupAssignedData(data)
        ? `/student/dashboard#school-${data.schoolId}`
        : undefined,
  },
  /**
   * The one notification a learner is owed rather than informed of — plan 42.
   *
   * Both outcomes and both kinds of approval land here, and the wording separates them:
   * being sent back asks for work, being marked with a comment asks for reading, being
   * marked in silence asks for nothing but still has to arrive.
   *
   * No link yet: the attempt carries a user and an exercise, and the learner's route to
   * an exercise runs through its course and unit, neither of which the attempt knows.
   * The same missing snapshot blocks the course-wide marking inbox, and both get a link
   * the day it exists — a wrong destination would be worse than none.
   */
  ATTEMPT_REVIEWED: {
    icon: ClipboardCheck,
    category: 'Learning',
    priority: 'normal',
    actionable: false,
    resolveTitle: (data, t) =>
      isAttemptReviewedData(data) && data.outcome === 'returned'
        ? t('types.ATTEMPT_REVIEWED.titleReturned')
        : t('types.ATTEMPT_REVIEWED.title'),
    resolveBody: (data, t) => {
      if (!isAttemptReviewedData(data)) return t('types.ATTEMPT_REVIEWED.bodyFallback');
      if (data.outcome === 'returned') {
        return data.comment !== null && data.comment.trim() !== ''
          ? t('types.ATTEMPT_REVIEWED.bodyReturnedWithComment', { comment: data.comment })
          : t('types.ATTEMPT_REVIEWED.bodyReturned');
      }
      if (data.comment !== null && data.comment.trim() !== '') {
        return t('types.ATTEMPT_REVIEWED.bodyWithComment', { comment: data.comment });
      }
      // Nothing written, so the numbers are the whole answer — and they are the answer
      // the learner was waiting for.
      return t('types.ATTEMPT_REVIEWED.body', {
        approved: data.approvedItems,
        total: data.totalItems,
      });
    },
    getLink: noLink,
  },
};

export function getNotificationEntry(type: NotificationType): NotificationRegistryEntry {
  return notificationRegistry[type] ?? notificationRegistry.GENERAL;
}
