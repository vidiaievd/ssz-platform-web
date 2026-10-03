import { describe, expect, it } from 'vitest';

import { canEditRecipe, settingsPagesFor } from './settings-pages';

describe('settingsPagesFor', () => {
  it('gives an owner and an administrator every page of a school', () => {
    for (const role of ['OWNER', 'ADMIN'] as const)
      expect(settingsPagesFor(role, 'SCHOOL')).toEqual([
        'profile',
        'account',
        'notifications',
        'review',
        'progress',
        'recipe',
      ]);
  });

  it('gives a content admin the lesson recipe and nothing else', () => {
    expect(settingsPagesFor('CONTENT_ADMIN', 'SCHOOL')).toEqual(['recipe']);
  });

  // A tutor's courses inherit nothing from their workspace yet.
  it('leaves the recipe out of a solo workspace', () => {
    expect(settingsPagesFor('OWNER', 'SOLO')).not.toContain('recipe');
  });

  it.each(['TEACHER', 'MANAGER', 'SCHEDULER', 'STUDENT', null] as const)(
    'gives %s no settings at all',
    (role) => {
      expect(settingsPagesFor(role, 'SCHOOL')).toEqual([]);
    },
  );
});

describe('canEditRecipe', () => {
  it('lets an owner and a content admin change it, and an administrator only read it', () => {
    expect(canEditRecipe('OWNER')).toBe(true);
    expect(canEditRecipe('CONTENT_ADMIN')).toBe(true);
    expect(canEditRecipe('ADMIN')).toBe(false);
  });
});
