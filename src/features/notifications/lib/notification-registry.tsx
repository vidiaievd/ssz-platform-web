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

import { hoursSince } from '@/features/review/lib/age-scale';

import type {
  AttemptReviewedData,
  EnrollmentApprovedData,
  EnrollmentRequestData,
  GroupAssignedData,
  NotificationCategory,
  NotificationTemplateData,
  NotificationType,
  PlacementReviewReadyData,
  ReviewDigestData,
  ReviewEscalationData,
  ReviewSchoolSummaryData,
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

function isReviewDigestData(data: unknown): data is ReviewDigestData {
  return !!data && typeof data === 'object' && 'pending' in data && 'groups' in data;
}

function isReviewEscalationData(data: unknown): data is ReviewEscalationData {
  return !!data && typeof data === 'object' && 'overdue' in data;
}

function isReviewSchoolSummaryData(data: unknown): data is ReviewSchoolSummaryData {
  return !!data && typeof data === 'object' && 'pending' in data && 'oldestAgeHours' in data;
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
      ctx.workspaceKind === 'school' && ctx.schoolSlug
        ? `/school/${ctx.schoolSlug}/enrollment/placement`
        : undefined,
  },
  GROUP_ASSIGNED: {
    icon: Users,
    category: 'Enrollment',
    priority: 'normal',
    actionable: false,
    resolveTitle: (data, t) =>
      isGroupAssignedData(data)
        ? t('types.GROUP_ASSIGNED.title', { group: data.groupName })
        : t('types.GROUP_ASSIGNED.titleFallback'),
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
   * The one notification a learner is owed rather than informed of — plan 42, enriched
   * by 47.4.
   *
   * Both outcomes and both kinds of approval land here, and the wording separates them:
   * being sent back asks for work, being marked with a comment asks for reading, being
   * marked in silence asks for nothing but still has to arrive (criterion 42).
   *
   * It now names the work and leads to it. The link goes to "Мои работы" rather than to
   * the exercise: that screen has the verdict, the comment and the way into a second
   * attempt all in one card, and it is addressable by the attempt alone — the exercise's
   * own place in a course is something the notification still does not know.
   */
  ATTEMPT_REVIEWED: {
    icon: ClipboardCheck,
    category: 'Learning',
    priority: 'normal',
    actionable: false,
    resolveTitle: (data, t) => {
      if (!isAttemptReviewedData(data)) return t('types.ATTEMPT_REVIEWED.title');
      // The exercise by name, because a learner who handed in a lesson's worth at one
      // sitting gets a column of these and "your work" tells them apart from nothing.
      const exercise = data.exercisePath?.exercise ?? null;
      if (data.outcome === 'returned') {
        return exercise === null
          ? t('types.ATTEMPT_REVIEWED.titleReturned')
          : t('types.ATTEMPT_REVIEWED.titleReturnedNamed', { exercise });
      }
      return exercise === null
        ? t('types.ATTEMPT_REVIEWED.title')
        : t('types.ATTEMPT_REVIEWED.titleNamed', { exercise });
    },
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
      // Approved with nothing said overall, but a note left on one sentence: there is
      // something to read, and the message must say so rather than close the matter.
      if (data.hasComment === true) {
        return t('types.ATTEMPT_REVIEWED.bodyApprovedWithNote');
      }
      // Nothing written anywhere, so the numbers are the whole answer — and criterion 42
      // says that answer still gets sent.
      return t('types.ATTEMPT_REVIEWED.body', {
        approved: data.approvedItems,
        total: data.totalItems,
      });
    },
    /**
     * Straight to the card this verdict lives in. Learner workspace only: a teacher who
     * happens to receive one has no "Мои работы" to be sent to.
     */
    getLink: (data, ctx) =>
      ctx.workspaceKind === 'student' && isAttemptReviewedData(data)
        ? `/student/submissions?submission=${data.attemptId}`
        : undefined,
  },
  /**
   * The teacher's half of the marking queue, on a timer (plan 47.5).
   *
   * One message a run, never one a submission: a class that hands in a lesson's worth of
   * exercises would otherwise fill an inbox with twelve identical lines and teach its
   * reader to ignore all of them (criterion 41).
   *
   * The breakdown is by count, not by group name: the message carries ids, and the names
   * live on the inbox it links to — copying them here would be a second copy to go stale
   * the day a group is renamed.
   */
  REVIEW_DIGEST: {
    icon: ClipboardCheck,
    category: 'Learning',
    priority: 'normal',
    actionable: true,
    resolveTitle: (data, t) =>
      isReviewDigestData(data)
        ? t('types.REVIEW_DIGEST.title', { count: data.pending })
        : t('types.REVIEW_DIGEST.titleFallback'),
    resolveBody: (data, t) => {
      if (!isReviewDigestData(data)) return t('types.REVIEW_DIGEST.bodyFallback');
      return t('types.REVIEW_DIGEST.body', {
        groups: data.groups.length,
        hours: Math.max(0, Math.round(hoursSince(data.oldestSubmittedAt))),
      });
    },
    getLink: (_data, ctx) =>
      ctx.workspaceKind === 'school' && ctx.schoolSlug
        ? `/school/${ctx.schoolSlug}/review`
        : undefined,
  },
  /**
   * The same queue, past what the school itself promised (44.12) — a different message
   * because it asks something different. At most one a day, decided by the job.
   */
  REVIEW_ESCALATION: {
    icon: AlertTriangle,
    category: 'Learning',
    priority: 'high',
    actionable: true,
    resolveTitle: (data, t) =>
      isReviewEscalationData(data)
        ? t('types.REVIEW_ESCALATION.title', { count: data.overdue })
        : t('types.REVIEW_ESCALATION.titleFallback'),
    resolveBody: (data, t) => {
      if (!isReviewEscalationData(data)) return t('types.REVIEW_ESCALATION.bodyFallback');
      const hours = Math.max(0, Math.round(hoursSince(data.oldestSubmittedAt)));
      // The copy sent to a school's admins asks something different from the one sent to
      // the teacher: find someone to help, rather than sit down and mark.
      return data.scope === 'school'
        ? t('types.REVIEW_ESCALATION.bodySchool', { hours })
        : t('types.REVIEW_ESCALATION.body', { hours, promised: data.escalateAfterHours });
    },
    getLink: (_data, ctx) =>
      ctx.workspaceKind === 'school' && ctx.schoolSlug
        ? `/school/${ctx.schoolSlug}/review`
        : undefined,
  },
  /**
   * The school's week (plan 47.6), to whoever `escalateTo` names.
   *
   * Its link is the oversight screen rather than a marking queue: the reader is being
   * asked whether the school is keeping up, which is a staffing question, and half of
   * them cannot mark anything themselves.
   */
  REVIEW_SCHOOL_SUMMARY: {
    icon: ClipboardCheck,
    category: 'Learning',
    priority: 'normal',
    actionable: false,
    resolveTitle: (data, t) =>
      isReviewSchoolSummaryData(data)
        ? t('types.REVIEW_SCHOOL_SUMMARY.title', { count: data.pending })
        : t('types.REVIEW_SCHOOL_SUMMARY.titleFallback'),
    resolveBody: (data, t) => {
      if (!isReviewSchoolSummaryData(data)) return t('types.REVIEW_SCHOOL_SUMMARY.bodyFallback');
      // A week with nothing late is worth saying plainly — the summary exists to be read
      // in one glance, and "0 overdue" buried in a sentence is not that.
      return data.overdue === 0
        ? t('types.REVIEW_SCHOOL_SUMMARY.bodyOnTime', {
            days: Math.floor(data.oldestAgeHours / 24),
          })
        : t('types.REVIEW_SCHOOL_SUMMARY.body', {
            overdue: data.overdue,
            days: Math.floor(data.oldestAgeHours / 24),
          });
    },
    getLink: (_data, ctx) =>
      ctx.workspaceKind === 'school' && ctx.schoolSlug
        ? `/school/${ctx.schoolSlug}/review/oversight`
        : undefined,
  },
};

export function getNotificationEntry(type: NotificationType): NotificationRegistryEntry {
  return notificationRegistry[type] ?? notificationRegistry.GENERAL;
}
