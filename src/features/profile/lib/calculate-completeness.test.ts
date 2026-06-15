import { describe, expect, it } from 'vitest';

import { calculateCompleteness, type FacetExtra } from './calculate-completeness';
import type { Profile } from '../types';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '1',
    userId: 'u1',
    handle: null,
    displayName: '',
    firstName: null,
    lastName: null,
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

const noFacets: FacetExtra = {
  hasTeaching: false,
  hasTutor: false,
  hasLearner: false,
  teachingLanguagesCount: 0,
  targetLanguagesCount: 0,
  hourlyRate: null,
  currency: null,
};

describe('calculateCompleteness', () => {
  it('returns 0% for an empty profile with no facets', () => {
    const result = calculateCompleteness(makeProfile(), noFacets);
    expect(result.score).toBe(0);
    expect(result.missingFields).toContain('displayName');
    expect(result.missingFields).toContain('avatarUrl');
    expect(result.missingFields).toContain('bio');
  });

  it('reaches 100% for core fields with no facets', () => {
    const result = calculateCompleteness(
      makeProfile({
        displayName: 'Jane Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'I teach Norwegian.',
        timezone: 'Europe/Oslo',
        contactEmail: 'jane@example.com',
      }),
      noFacets,
    );
    expect(result.score).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it('does not count displayName if empty string', () => {
    const result = calculateCompleteness(makeProfile({ displayName: '   ' }), noFacets);
    expect(result.missingFields).toContain('displayName');
  });

  it('does not count UTC as a filled timezone', () => {
    const result = calculateCompleteness(makeProfile({ timezone: 'UTC' }), noFacets);
    expect(result.missingFields).toContain('timezone');
  });

  it('includes teachingLanguages field only when teaching facet is active', () => {
    const withTeaching: FacetExtra = { ...noFacets, hasTeaching: true, teachingLanguagesCount: 0 };
    const without = calculateCompleteness(makeProfile({ displayName: 'Jane', timezone: 'Europe/Oslo', bio: 'x', avatarUrl: 'http://x.com/a.jpg', contactEmail: 'j@j.com' }), noFacets);
    const withResult = calculateCompleteness(makeProfile({ displayName: 'Jane', timezone: 'Europe/Oslo', bio: 'x', avatarUrl: 'http://x.com/a.jpg', contactEmail: 'j@j.com' }), withTeaching);
    expect(without.score).toBe(100);
    expect(withResult.score).toBeLessThan(100);
    expect(withResult.missingFields).toContain('teachingLanguages');
  });

  it('awards teaching languages weight when at least 1 language exists', () => {
    const extra: FacetExtra = { ...noFacets, hasTeaching: true, teachingLanguagesCount: 1 };
    const result = calculateCompleteness(
      makeProfile({ displayName: 'J', avatarUrl: 'http://x.com/a.jpg', bio: 'x', timezone: 'Europe/Oslo', contactEmail: 'j@j.com' }),
      extra,
    );
    expect(result.score).toBe(100);
  });

  it('penalises missing rate+currency for tutor facet', () => {
    const extra: FacetExtra = { ...noFacets, hasTutor: true, hourlyRate: null, currency: null };
    const result = calculateCompleteness(
      makeProfile({ displayName: 'J', avatarUrl: 'http://x.com/a.jpg', bio: 'x', timezone: 'Europe/Oslo', contactEmail: 'j@j.com' }),
      extra,
    );
    expect(result.missingFields).toContain('hourlyRateCurrency');
    expect(result.score).toBeLessThan(100);
  });
});
