import { describe, expect, it } from 'vitest';

import { matchAlsoTaughtAt } from './course-school-match';
import type { Container } from '@/features/content/types';

const BASE: Container = {
  id: 'container-1',
  slug: 'norwegian-a1',
  title: 'Norwegian A1',
  containerType: 'course',
  targetLanguage: 'no',
  difficultyLevel: 'A1',
  visibility: 'public',
  accessTier: 'public_free',
  ownerUserId: 'user-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('matchAlsoTaughtAt', () => {
  it('returns the owning school when the container has one', () => {
    const container: Container = { ...BASE, ownerSchoolId: 'school-1', ownerName: 'Nordlys' };
    expect(matchAlsoTaughtAt(container)).toEqual({ schoolId: 'school-1', schoolName: 'Nordlys' });
  });

  it('returns null for a self-published container with no owning school', () => {
    expect(matchAlsoTaughtAt(BASE)).toBeNull();
  });

  it('returns null when ownerSchoolId is set but the school name was not resolved', () => {
    const container: Container = { ...BASE, ownerSchoolId: 'school-1' };
    expect(matchAlsoTaughtAt(container)).toBeNull();
  });
});
