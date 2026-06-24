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
});
