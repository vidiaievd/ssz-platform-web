import { describe, it, expect } from 'vitest';
import { resolvePostLoginPath } from './resolve-post-login-path';

type Auth = Parameters<typeof resolvePostLoginPath>[0];

describe('resolvePostLoginPath', () => {
  // --- redirect override ---
  it('respects a safe redirect override', () => {
    const auth: Auth = { roles: ['student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth, '/some/path')).toBe('/some/path');
  });

  it('ignores a redirect that does not start with /', () => {
    const auth: Auth = { roles: ['student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth, 'evil.com')).toBe('/school');
  });

  it('ignores a redirect that starts with //', () => {
    const auth: Auth = { roles: ['student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth, '//evil.com')).toBe('/school');
  });

  // --- all roles → /school ---
  it('routes school_admin to /school', () => {
    const auth: Auth = { roles: ['school_admin'], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });

  it('routes tutor to /school', () => {
    const auth: Auth = { roles: ['tutor'], hasStudentProfile: false, hasTutorProfile: true };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });

  it('routes teacher to /school', () => {
    const auth: Auth = { roles: ['teacher'], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });

  it('routes student to /school', () => {
    const auth: Auth = { roles: ['student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });

  it('routes unknown roles to /school', () => {
    const auth: Auth = { roles: [], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });

  it('routes mixed roles to /school', () => {
    const auth: Auth = { roles: ['school_admin', 'student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });
});
