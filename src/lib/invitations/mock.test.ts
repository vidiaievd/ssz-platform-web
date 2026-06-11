// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors/app-error';
import { mockProvider, resetMockStore } from './mock';

beforeEach(() => resetMockStore());

// ── mockProvider.preview ──────────────────────────────────────────────────────

describe('mockProvider.preview', () => {
  it('returns pending preview for valid-* token', async () => {
    const preview = await mockProvider.preview('valid-abc123');
    expect(preview.status).toBe('pending');
    expect(preview.schoolName).toBeTruthy();
    expect(preview.email).toBeTruthy();
  });

  it('throws AppError gone for expired-* token', async () => {
    await expect(mockProvider.preview('expired-abc')).rejects.toMatchObject({
      code: 'gone',
    });
  });

  it('throws AppError gone instance for expired-* token', async () => {
    await expect(mockProvider.preview('expired-test')).rejects.toBeInstanceOf(AppError);
  });

  it('returns revoked preview for revoked-* token', async () => {
    const preview = await mockProvider.preview('revoked-xyz');
    expect(preview.status).toBe('revoked');
  });

  it('returns accepted preview for accepted-* token', async () => {
    const preview = await mockProvider.preview('accepted-xyz');
    expect(preview.status).toBe('accepted');
  });

  it('throws not_found for unknown token', async () => {
    await expect(mockProvider.preview('unknown-garbage')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('returns tutoring preview for tutoring-* token', async () => {
    const preview = await mockProvider.preview('tutoring-abc');
    expect(preview.status).toBe('pending');
    expect(preview.schoolSlug).toBe('');
    expect(preview.role).toBe('STUDENT');
  });
});

describe('mockProvider.list', () => {
  it('returns all school fixtures without filter', async () => {
    const items = await mockProvider.list('school-1');
    expect(items.length).toBeGreaterThan(0);
  });

  it('filters by role', async () => {
    const items = await mockProvider.list('school-1', { role: 'TEACHER' });
    expect(items.every((i) => i.role === 'TEACHER')).toBe(true);
  });

  it('filters by status', async () => {
    const items = await mockProvider.list('school-1', { status: 'accepted' });
    expect(items.every((i) => i.status === 'accepted')).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe('mockProvider.resend', () => {
  it('extends expiresAt and increments resendCount', async () => {
    const before = (await mockProvider.list('school-1')).find(
      (i) => i.invitationId === 'inv-teacher-pending',
    )!;
    const result = await mockProvider.resend('school-1', 'inv-teacher-pending');
    expect(result.resendCount).toBe(before.resendCount + 1);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(
      new Date(before.expiresAt).getTime(),
    );
  });

  it('throws conflict for accepted invitation', async () => {
    await expect(
      mockProvider.resend('school-1', 'inv-student-accepted'),
    ).rejects.toMatchObject(expect.objectContaining({ code: 'conflict' }));
  });
});

describe('mockProvider.revoke', () => {
  it('marks invitation as revoked', async () => {
    await mockProvider.revoke('school-1', 'inv-teacher-pending');
    const items = await mockProvider.list('school-1');
    const inv = items.find((i) => i.invitationId === 'inv-teacher-pending')!;
    expect(inv.status).toBe('revoked');
  });

  it('throws conflict when revoking an accepted invitation', async () => {
    await expect(
      mockProvider.revoke('school-1', 'inv-student-accepted'),
    ).rejects.toMatchObject(expect.objectContaining({ code: 'conflict' }));
  });

  it('does not appear in subsequent list (state persists)', async () => {
    await mockProvider.revoke('school-1', 'inv-teacher-pending');
    const items = await mockProvider.list('school-1', { status: 'pending' });
    expect(items.find((i) => i.invitationId === 'inv-teacher-pending')).toBeUndefined();
  });

  it('throws AppError', async () => {
    await expect(
      mockProvider.revoke('school-1', 'inv-student-accepted'),
    ).rejects.toBeInstanceOf(AppError);
  });
});
