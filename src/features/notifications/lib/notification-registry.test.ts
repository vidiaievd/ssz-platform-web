import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../../../../messages/en.json';
import type { EnrollmentRequestData } from '../types';
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
});
