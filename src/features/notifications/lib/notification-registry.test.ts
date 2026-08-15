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
    const data = { membershipId: 'm1', schoolId: 's1', schoolName: 'Greenwood School', occurredAt: new Date().toISOString() };

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

    // The attempt knows its exercise but not the course and unit the learner reaches it
    // through, so there is no honest destination to send them to yet.
    it('carries no link rather than a guessed one', () => {
      const entry = getNotificationEntry('ATTEMPT_REVIEWED');

      expect(entry.getLink(reviewed(), { workspaceKind: 'student' })).toBeUndefined();
    });
  });
});
