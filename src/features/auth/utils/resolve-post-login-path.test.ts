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
    expect(resolvePostLoginPath(auth, 'evil.com')).toBe('/student/dashboard');
  });

  it('ignores a redirect that starts with //', () => {
    const auth: Auth = { roles: ['student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth, '//evil.com')).toBe('/student/dashboard');
  });

  // --- school_admin ---
  it('routes school_admin to /school', () => {
    const auth: Auth = { roles: ['school_admin'], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });

  // --- tutor ---
  it('routes tutor with profile to /tutor', () => {
    const auth: Auth = { roles: ['tutor'], hasStudentProfile: false, hasTutorProfile: true };
    expect(resolvePostLoginPath(auth)).toBe('/tutor');
  });

  it('routes tutor without profile to onboarding', () => {
    const auth: Auth = { roles: ['tutor'], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/onboarding?step=profile');
  });

  // --- student ---
  it('routes student with profile to /student/dashboard', () => {
    const auth: Auth = { roles: ['student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/student/dashboard');
  });

  it('routes student without profile to onboarding', () => {
    const auth: Auth = { roles: ['student'], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/onboarding?step=profile');
  });

  // --- fallback ---
  it('falls back to /student/dashboard for unknown roles', () => {
    const auth: Auth = { roles: [], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/student/dashboard');
  });

  // --- school_admin takes priority over other roles ---
  it('routes school_admin+student to /school (admin wins)', () => {
    const auth: Auth = { roles: ['school_admin', 'student'], hasStudentProfile: true, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });

  // --- new user verify-time scenario (no profiles yet) ---
  it('routes new tutor (no profile) via verify flow to onboarding', () => {
    const auth: Auth = { roles: ['tutor'], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/onboarding?step=profile');
  });

  it('routes new school_admin via verify flow to /school (then /onboarding/school)', () => {
    const auth: Auth = { roles: ['school_admin'], hasStudentProfile: false, hasTutorProfile: false };
    expect(resolvePostLoginPath(auth)).toBe('/school');
  });
});
