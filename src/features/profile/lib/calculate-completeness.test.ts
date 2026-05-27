import { describe, expect, it } from 'vitest';

import { calculateCompleteness } from './calculate-completeness';
import type { Profile } from '../types';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '1',
    userId: 'u1',
    handle: null,
    displayName: '',
    bio: null,
    avatarUrl: null,
    uiLocale: 'en',
    instructionLocales: [],
    timezone: 'UTC',
    contactEmail: null,
    contactPhone: null,
    hasStudentProfile: false,
    hasTutorProfile: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateCompleteness', () => {
  it('returns 0% for an empty profile', () => {
    const result = calculateCompleteness(makeProfile());
    expect(result.score).toBe(0);
    expect(result.missingFields).toContain('displayName');
    expect(result.missingFields).toContain('avatarUrl');
    expect(result.missingFields).toContain('bio');
  });

  it('awards points for each filled field', () => {
    const result = calculateCompleteness(
      makeProfile({
        displayName: 'Jane Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'I teach Norwegian.',
        timezone: 'Europe/Oslo',
        instructionLocales: ['nb', 'en'],
        contactEmail: 'jane@example.com',
        contactPhone: '+47 123 45 678',
      }),
    );
    expect(result.score).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it('returns partial score for a partially filled profile', () => {
    const result = calculateCompleteness(
      makeProfile({ displayName: 'Jane', avatarUrl: 'https://example.com/a.jpg' }),
    );
    // displayName (25) + avatarUrl (20) = 45
    expect(result.score).toBe(45);
    expect(result.missingFields).toContain('bio');
    expect(result.missingFields).toContain('timezone');
  });

  it('does not count displayName if empty string', () => {
    const result = calculateCompleteness(makeProfile({ displayName: '   ' }));
    expect(result.missingFields).toContain('displayName');
  });

  it('does not count UTC as a filled timezone', () => {
    const result = calculateCompleteness(makeProfile({ timezone: 'UTC' }));
    expect(result.missingFields).toContain('timezone');
  });
});
