import { describe, expect, it } from 'vitest';

import { canEditRecipe, settingsPagesFor } from './settings-pages';

describe('settingsPagesFor', () => {
  it('gives an owner and an administrator every page of a school', () => {
    const pages = ['profile', 'account', 'notifications', 'review', 'progress', 'recipe'];
    expect(settingsPagesFor('ADMIN', 'SCHOOL')).toEqual(pages);
    expect(settingsPagesFor('OWNER', 'SCHOOL')).toEqual([...pages, 'danger']);
  });

  // Plan 90, block 9, step 5: only an owner deletes a school, and never a solo workspace.
  it('keeps the danger zone for the owner of a school', () => {
    expect(settingsPagesFor('OWNER', 'SOLO')).not.toContain('danger');
    expect(settingsPagesFor('ADMIN', 'SCHOOL')).not.toContain('danger');
    expect(settingsPagesFor('CONTENT_ADMIN', 'SCHOOL')).not.toContain('danger');
  });

  // Plan 83, step 3c: without the key the school pays for nobody, so there is nothing to set.
  it('adds the assistant after the review only when the plan carries ai.student_assist', () => {
    expect(settingsPagesFor('OWNER', 'SCHOOL')).not.toContain('assistant');
    expect(settingsPagesFor('ADMIN', 'SCHOOL', { studentAssist: true })).toEqual([
      'profile',
      'account',
      'notifications',
      'review',
      'assistant',
      'progress',
      'recipe',
    ]);
    expect(settingsPagesFor('OWNER', 'SOLO', { studentAssist: true })).toContain('assistant');
    expect(settingsPagesFor('CONTENT_ADMIN', 'SCHOOL', { studentAssist: true })).toEqual([
      'recipe',
    ]);
  });

  // Plan 84, step 9: the rehearsal is paid from the `ai.practice` pool.
  it('adds the check before hand-in after the review only when the plan carries ai.practice', () => {
    expect(settingsPagesFor('OWNER', 'SCHOOL')).not.toContain('precheck');
    expect(settingsPagesFor('ADMIN', 'SCHOOL', { studentAssist: true, aiPractice: true })).toEqual([
      'profile',
      'account',
      'notifications',
      'review',
      'assistant',
      'precheck',
      'progress',
      'recipe',
    ]);
    expect(settingsPagesFor('OWNER', 'SOLO', { aiPractice: true })).toContain('precheck');
    expect(settingsPagesFor('CONTENT_ADMIN', 'SCHOOL', { aiPractice: true })).toEqual(['recipe']);
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
