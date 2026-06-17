// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { isMinor, assertAdult } from './assert-adult';

describe('isMinor', () => {
  it('returns false when dateOfBirth is undefined', () => {
    expect(isMinor(undefined)).toBe(false);
  });

  it('returns false for a clearly adult DOB (30 years ago)', () => {
    const thirtyYearsAgo = new Date();
    thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);
    expect(isMinor(thirtyYearsAgo.toISOString().slice(0, 10))).toBe(false);
  });

  it('returns true for a clearly minor DOB (10 years ago)', () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    expect(isMinor(tenYearsAgo.toISOString().slice(0, 10))).toBe(true);
  });

  it('returns false on exact 18th birthday', () => {
    const today = new Date();
    const dob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    expect(isMinor(dob.toISOString().slice(0, 10))).toBe(false);
  });

  it('returns true for someone who turns 18 next year (still a minor)', () => {
    const today = new Date();
    // DOB set so the person is 17 years old: born exactly one year after the 18-years-ago point
    const dob = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
    expect(isMinor(dob.toISOString().slice(0, 10))).toBe(true);
  });
});

describe('assertAdult', () => {
  it('does not throw for an adult DOB', () => {
    expect(() => assertAdult({ dateOfBirth: '1990-05-20' })).not.toThrow();
  });

  it('does not throw for a minor DOB (adults-only no-op for now)', () => {
    expect(() => assertAdult({ dateOfBirth: '2020-01-01' })).not.toThrow();
  });

  it('does not throw when dateOfBirth is absent', () => {
    expect(() => assertAdult({})).not.toThrow();
  });
});
