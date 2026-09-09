import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages as en } from '@/lib/i18n/messages';
import type { AttemptReviewedData, EnrollmentRequestData } from '../types';
import { getNotificationEntry } from './notification-registry';

const t = createTranslator({ locale: 'en', messages: en, namespace: 'Notifications' });

describe('notification-registry', () => {
  it('renders the student name in the ENROLLMENT_REQUEST title and body', () => {
    const data: EnrollmentRequestData = {
      membershipId: 'm1',
      schoolId: 's1',
      schoolName: 'Greenwood School',
      studentId: 'u1',
      studentName: 'Maria Hansen',
      source: 'public-apply',
      occurredAt: new Date().toISOString(),
    };
    const entry = getNotificationEntry('ENROLLMENT_REQUEST');

    expect(entry.resolveTitle(data, t)).toContain('Maria Hansen');
    expect(entry.resolveBody(data, t)).toContain('Greenwood School');
  });

  it('falls back to a safe title when ENROLLMENT_REQUEST data is missing', () => {
    const entry = getNotificationEntry('ENROLLMENT_REQUEST');

    expect(entry.resolveTitle(undefined, t)).toBe(t('types.ENROLLMENT_REQUEST.titleFallback'));
  });

  it('marks ENROLLMENT_REQUEST as actionable and links into approvals for the school workspace', () => {
    const entry = getNotificationEntry('ENROLLMENT_REQUEST');

    expect(entry.actionable).toBe(true);
    expect(entry.getLink(undefined, { workspaceKind: 'school', schoolSlug: 'greenwood' })).toBe(
      '/school/greenwood/enrollment/requests',
    );
    expect(entry.getLink(undefined, { workspaceKind: 'student' })).toBeUndefined();
  });

  it('falls back to the GENERAL entry for an unknown type without exposing a raw enum', () => {
    const entry = getNotificationEntry('NOT_A_REAL_TYPE' as never);

    expect(entry.resolveTitle(undefined, t)).toBe(t('types.GENERAL.title'));
  });

  it('deep-links ENROLLMENT_APPROVED to the school card on the student home page', () => {
    const entry = getNotificationEntry('ENROLLMENT_APPROVED');
    const data = {
      membershipId: 'm1',
      schoolId: 's1',
      schoolName: 'Greenwood School',
      occurredAt: new Date().toISOString(),
    };

    expect(entry.resolveBody(data, t)).toContain('Greenwood School');
    expect(entry.getLink(data, { workspaceKind: 'student' })).toBe('/student/dashboard#school-s1');
    expect(entry.getLink(data, { workspaceKind: 'school' })).toBeUndefined();
  });

  it('deep-links GROUP_ASSIGNED to the school card with the group name in the copy', () => {
    const entry = getNotificationEntry('GROUP_ASSIGNED');
    const data = {
      membershipId: 'm1',
      schoolId: 's1',
      schoolName: 'Greenwood School',
      groupId: 'g1',
      groupName: 'Norwegian A2',
      occurredAt: new Date().toISOString(),
    };

    expect(entry.resolveTitle(data, t)).toContain('Norwegian A2');
    expect(entry.resolveBody(data, t)).toContain('Norwegian A2');
    expect(entry.getLink(data, { workspaceKind: 'student' })).toBe('/student/dashboard#school-s1');
  });

  it('routes PLACEMENT_REVIEW_READY to the admin placement queue, not a student page', () => {
    const entry = getNotificationEntry('PLACEMENT_REVIEW_READY');

    expect(entry.getLink(undefined, { workspaceKind: 'school', schoolSlug: 'greenwood' })).toBe(
      '/school/greenwood/enrollment/placement',
    );
    expect(entry.getLink(undefined, { workspaceKind: 'student' })).toBeUndefined();
  });

  /**
   * Plan 47.5: the teacher's half of the same subsystem — one message a run about a
   * whole queue, and a louder one when the queue has gone past what the school allows.
   */
  describe('REVIEW_DIGEST and REVIEW_ESCALATION', () => {
    const digest = {
      schoolId: 's1',
      pending: 12,
      groups: [
        { groupId: 'g1', pending: 8 },
        { groupId: 'g2', pending: 4 },
      ],
      oldestSubmittedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    };

    it('counts a whole sitting into one line rather than twelve notifications', () => {
      const entry = getNotificationEntry('REVIEW_DIGEST');

      expect(entry.resolveTitle(digest, t)).toBe('12 submissions are waiting for you');
      expect(entry.resolveBody(digest, t)).toContain('Across 2 groups');
      expect(entry.resolveBody(digest, t)).toContain('30 hours');
    });

    it('sends a teacher to their own marking queue, and a learner nowhere', () => {
      const entry = getNotificationEntry('REVIEW_DIGEST');

      expect(entry.getLink(digest, { workspaceKind: 'school', schoolSlug: 'greenwood' })).toBe(
        '/school/greenwood/review',
      );
      expect(entry.getLink(digest, { workspaceKind: 'student' })).toBeUndefined();
    });

    it('reads as urgent when the queue is past what the school allows', () => {
      const entry = getNotificationEntry('REVIEW_ESCALATION');
      const data = {
        schoolId: 's1',
        overdue: 3,
        oldestSubmittedAt: new Date(Date.now() - 70 * 60 * 60 * 1000).toISOString(),
        escalateAfterHours: 48,
      };

      expect(entry.priority).toBe('high');
      expect(entry.resolveTitle(data, t)).toBe('3 submissions have been waiting too long');
      expect(entry.resolveBody(data, t)).toContain('70 hours');
      expect(entry.resolveBody(data, t)).toContain('48');
    });

    /**
     * The same lateness reaches two people with two different asks: the teacher is asked
     * to mark, the school is asked to find someone who can.
     */
    it('asks a school for help rather than telling it to mark', () => {
      const entry = getNotificationEntry('REVIEW_ESCALATION');
      const data = {
        schoolId: 's1',
        overdue: 3,
        oldestSubmittedAt: new Date(Date.now() - 70 * 60 * 60 * 1000).toISOString(),
        escalateAfterHours: 48,
        scope: 'school' as const,
        target: 'school_admins',
      };

      expect(entry.resolveBody(data, t)).toContain('second marker');
    });

    it('summarises the school’s week and points at the overview, not a queue', () => {
      const entry = getNotificationEntry('REVIEW_SCHOOL_SUMMARY');
      const data = {
        schoolId: 's1',
        pending: 24,
        overdue: 5,
        oldestAgeHours: 76,
        oldestSubmittedAt: new Date(Date.now() - 76 * 60 * 60 * 1000).toISOString(),
      };

      expect(entry.resolveTitle(data, t)).toBe('24 submissions are waiting across your school');
      expect(entry.resolveBody(data, t)).toContain('5 are past your response time');
      expect(entry.resolveBody(data, t)).toContain('3 days');
      expect(entry.getLink(data, { workspaceKind: 'school', schoolSlug: 'greenwood' })).toBe(
        '/school/greenwood/review/oversight',
      );
    });

    /** A week with nothing late is worth saying plainly, not burying in a zero. */
    it('says a school is keeping up in its own words', () => {
      const entry = getNotificationEntry('REVIEW_SCHOOL_SUMMARY');
      const data = {
        schoolId: 's1',
        pending: 6,
        overdue: 0,
        oldestAgeHours: 10,
        oldestSubmittedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
      };

      expect(entry.resolveBody(data, t)).toContain('within your response time');
      expect(entry.resolveBody(data, t)).toContain('less than a day');
    });

    it('still says something useful when the message carries no numbers', () => {
      expect(getNotificationEntry('REVIEW_DIGEST').resolveTitle(undefined, t)).toBe(
        t('types.REVIEW_DIGEST.titleFallback'),
      );
      expect(getNotificationEntry('REVIEW_ESCALATION').resolveBody(undefined, t)).toBe(
        t('types.REVIEW_ESCALATION.bodyFallback'),
      );
    });
  });

  /**
   * Plan 42: the three answers a learner can get from a teacher read differently, and the
   * quiet one is the one that must not be dropped — an approval nobody wrote on is still
   * the end of the wait.
   */
  describe('ATTEMPT_REVIEWED', () => {
    const reviewed = (overrides: Partial<AttemptReviewedData> = {}): AttemptReviewedData => ({
      attemptId: 'att-1',
      exerciseId: 'ex-1',
      templateCode: 'translate_to_target',
      outcome: 'approved',
      score: 80,
      comment: null,
      approvedItems: 4,
      totalItems: 5,
      occurredAt: new Date().toISOString(),
      ...overrides,
    });

    it('says how much counted when the teacher wrote nothing', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');

      expect(entry.resolveTitle(reviewed(), t)).toBe(t('types.ATTEMPT_REVIEWED.title'));
      expect(entry.resolveBody(reviewed(), t)).toBe('4 of 5 sentences counted.');
    });

    it('puts the teacher’s own words first when there are any', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');

      expect(entry.resolveBody(reviewed({ comment: 'Fin bruk av perfektum.' }), t)).toContain(
        'Fin bruk av perfektum.',
      );
    });

    it('reads as a request for work when the submission was sent back', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');
      const data = reviewed({ outcome: 'returned', score: null, comment: null });

      expect(entry.resolveTitle(data, t)).toBe(t('types.ATTEMPT_REVIEWED.titleReturned'));
      expect(entry.resolveBody(data, t)).toBe(t('types.ATTEMPT_REVIEWED.bodyReturned'));
    });

    /**
     * 47.4: the verdict now leads back to the card that holds it — comment, teacher and
     * the way into a second attempt — rather than leaving the learner to go and find it.
     */
    it('leads to the card this verdict lives in, for the learner and nobody else', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');

      expect(entry.getLink(reviewed(), { workspaceKind: 'student' })).toBe(
        '/student/submissions?submission=att-1',
      );
      expect(entry.getLink(reviewed(), { workspaceKind: 'school' })).toBeUndefined();
    });

    it('names the exercise when the attempt carried one', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');
      const path = { course: 'Ny i Norge — A2', module: 'Leksjon 19', exercise: 'Familien' };

      expect(entry.resolveTitle(reviewed({ exercisePath: path }), t)).toBe(
        'Your teacher has marked “Familien”',
      );
      expect(entry.resolveTitle(reviewed({ exercisePath: path, outcome: 'returned' }), t)).toBe(
        'Your teacher sent “Familien” back',
      );
    });

    /**
     * A note on one sentence with nothing said overall: there is something to read, and
     * the tally alone would close a matter that is still open.
     */
    it('sends the learner to read a note left on a single sentence', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');

      expect(entry.resolveBody(reviewed({ comment: null, hasComment: true }), t)).toBe(
        t('types.ATTEMPT_REVIEWED.bodyApprovedWithNote'),
      );
    });

    /** Criterion 42: the silent approval is still a message, and still says what counted. */
    it('keeps saying how much counted when nobody wrote anything anywhere', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');

      expect(entry.resolveBody(reviewed({ comment: null, hasComment: false }), t)).toBe(
        '4 of 5 sentences counted.',
      );
    });
  });
});
