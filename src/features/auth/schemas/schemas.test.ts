import { describe, expect, it } from 'vitest';

import {
  forgotPasswordSchema,
  loginSchema,
  mfaChallengeSchema,
  registerSchema,
  resetPasswordSchema,
} from './index';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'pass' }).success).toBe(
      true,
    );
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'pass' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });
});

describe('mfaChallengeSchema', () => {
  const base = { mfaChallengeToken: 'token' };

  it('accepts a valid 6-digit code', () => {
    expect(mfaChallengeSchema.safeParse({ ...base, code: '123456' }).success).toBe(true);
  });

  it('rejects a 5-digit code', () => {
    expect(mfaChallengeSchema.safeParse({ ...base, code: '12345' }).success).toBe(false);
  });

  it('rejects a 7-digit code', () => {
    expect(mfaChallengeSchema.safeParse({ ...base, code: '1234567' }).success).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(mfaChallengeSchema.safeParse({ ...base, code: 'abcdef' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'ValidPass1!',
    passwordConfirm: 'ValidPass1!',
    acceptedTerms: true as const,
  };

  it('accepts valid registration data', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an optional role', () => {
    expect(registerSchema.safeParse({ ...valid, role: 'student' }).success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    expect(registerSchema.safeParse({ ...valid, passwordConfirm: 'different' }).success).toBe(
      false,
    );
  });

  it('rejects a password shorter than 8 characters', () => {
    const short = 'Ab1!';
    expect(
      registerSchema.safeParse({ ...valid, password: short, passwordConfirm: short }).success,
    ).toBe(false);
  });

  it('rejects a password without an uppercase letter', () => {
    const pw = 'nouppercase1!';
    expect(
      registerSchema.safeParse({ ...valid, password: pw, passwordConfirm: pw }).success,
    ).toBe(false);
  });

  it('rejects a password without a digit', () => {
    const pw = 'NoDigitsHere!';
    expect(
      registerSchema.safeParse({ ...valid, password: pw, passwordConfirm: pw }).success,
    ).toBe(false);
  });

  it('rejects a password without a special character', () => {
    const pw = 'NoSpecial1A';
    expect(
      registerSchema.safeParse({ ...valid, password: pw, passwordConfirm: pw }).success,
    ).toBe(false);
  });

  it('rejects unaccepted terms', () => {
    expect(registerSchema.safeParse({ ...valid, acceptedTerms: false }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const valid = { token: 'reset-token', password: 'NewPass1!', passwordConfirm: 'NewPass1!' };

  it('accepts valid reset data', () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, passwordConfirm: 'wrong' }).success).toBe(
      false,
    );
  });

  it('rejects a weak password', () => {
    expect(
      resetPasswordSchema.safeParse({ ...valid, password: 'weak', passwordConfirm: 'weak' })
        .success,
    ).toBe(false);
  });

  it('rejects a missing token', () => {
    expect(resetPasswordSchema.safeParse({ ...valid, token: '' }).success).toBe(false);
  });
});
