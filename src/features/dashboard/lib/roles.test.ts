import { describe, expect, it } from 'vitest';

import type { DashboardRole, DataState, SchoolType } from '../types';
import { canSeeWidget, kpiSetFor, navGating, quickActionsFor } from './roles';

// ─── navGating ────────────────────────────────────────────────────────────────

describe('navGating', () => {
  it('owner sees all nav items enabled', () => {
    const gating = navGating('owner');
    expect(gating.dashboard).toBe('enabled');
    expect(gating.analytics).toBe('enabled');
    expect(gating.branding).toBe('enabled');
    expect(gating.permissions).toBe('enabled');
    expect(gating.moderation).toBe('enabled');
    expect(gating.settings).toBe('enabled');
  });

  it('admin sees all nav items enabled', () => {
    const gating = navGating('admin');
    expect(Object.values(gating).every((v) => v === 'enabled')).toBe(true);
  });

  it('teacher sees dashboard/courses/groups/students enabled', () => {
    const gating = navGating('teacher');
    expect(gating.dashboard).toBe('enabled');
    expect(gating.courses).toBe('enabled');
    expect(gating.groups).toBe('enabled');
    expect(gating.students).toBe('enabled');
    expect(gating.teachers).toBe('locked');
    expect(gating.analytics).toBe('locked');
    expect(gating.branding).toBe('locked');
    expect(gating.permissions).toBe('locked');
    expect(gating.moderation).toBe('locked');
    expect(gating.settings).toBe('locked');
  });

  it('editor sees only courses/moderation enabled', () => {
    const gating = navGating('editor');
    expect(gating.courses).toBe('enabled');
    expect(gating.moderation).toBe('enabled');
    expect(gating.dashboard).toBe('locked');
    expect(gating.students).toBe('locked');
    expect(gating.analytics).toBe('locked');
  });
});

// ─── kpiSetFor ────────────────────────────────────────────────────────────────

describe('kpiSetFor', () => {
  // v3: operations-weighted KPIs for owner/admin
  it('owner gets 4 operations KPIs', () => {
    const keys = kpiSetFor('owner');
    expect(keys).toContain('active_groups');
    expect(keys).toContain('active_students_7d');
    expect(keys).toContain('avg_teacher_load');
    expect(keys).toContain('scheduling_conflicts');
    expect(keys).toHaveLength(4);
  });

  it('admin gets same 4 operations KPIs as owner', () => {
    expect(kpiSetFor('admin')).toEqual(kpiSetFor('owner'));
  });

  it('teacher gets personal workload KPIs (my_groups, my_students, lessons_per_week, my_load)', () => {
    const keys = kpiSetFor('teacher');
    expect(keys).toContain('my_groups');
    expect(keys).toContain('my_load');
    expect(keys).not.toContain('at_risk');
    expect(keys).toHaveLength(4);
  });

  it('editor gets minimal KPI set', () => {
    expect(kpiSetFor('editor')).not.toContain('at_risk');
    expect(kpiSetFor('editor')).toHaveLength(2);
  });
});

// ─── quickActionsFor ──────────────────────────────────────────────────────────

describe('quickActionsFor', () => {
  it('owner includes new-group and teacher-timetable actions (v3)', () => {
    const ids = quickActionsFor('owner').map((a) => a.id);
    expect(ids).toContain('new-group');
    expect(ids).toContain('teacher-timetable');
    expect(ids).toContain('new-course');
  });

  it('admin gets same actions as owner (v3)', () => {
    expect(quickActionsFor('admin').map((a) => a.id)).toEqual(
      quickActionsFor('owner').map((a) => a.id),
    );
  });

  it('teacher gets my-groups and my-timetable actions (v3)', () => {
    const ids = quickActionsFor('teacher').map((a) => a.id);
    expect(ids).toContain('new-lesson');
    expect(ids).toContain('my-groups');
    expect(ids).toContain('my-timetable');
    expect(ids).toContain('grade-queue');
    expect(ids).not.toContain('new-course');
  });

  it('editor gets no quick actions', () => {
    expect(quickActionsFor('editor')).toHaveLength(0);
  });
});

// ─── canSeeWidget ─────────────────────────────────────────────────────────────

type Ctx = { role: DashboardRole; dataState: DataState; schoolType: SchoolType };

describe('canSeeWidget', () => {
  const ownerFull: Ctx = { role: 'owner', dataState: 'full', schoolType: 'online' };
  const ownerEmpty: Ctx = { role: 'owner', dataState: 'empty', schoolType: 'online' };
  const teacherFull: Ctx = { role: 'teacher', dataState: 'full', schoolType: 'online' };
  const adminPartial: Ctx = { role: 'admin', dataState: 'partial', schoolType: 'online' };
  const ownerHybridFull: Ctx = { role: 'owner', dataState: 'full', schoolType: 'hybrid' };

  it('kpis is always visible', () => {
    expect(canSeeWidget('kpis', ownerFull)).toBe(true);
    expect(canSeeWidget('kpis', teacherFull)).toBe(true);
    expect(canSeeWidget('kpis', ownerEmpty)).toBe(true);
  });

  it('activity is hidden when empty', () => {
    expect(canSeeWidget('activity', ownerEmpty)).toBe(false);
    expect(canSeeWidget('activity', ownerFull)).toBe(true);
  });

  it('courseHealth is only for owner/admin in full state', () => {
    expect(canSeeWidget('courseHealth', ownerFull)).toBe(true);
    expect(canSeeWidget('courseHealth', adminPartial)).toBe(false);
    expect(canSeeWidget('courseHealth', teacherFull)).toBe(false);
  });

  it('atRisk is hidden for teacher', () => {
    expect(canSeeWidget('atRisk', teacherFull)).toBe(false);
    expect(canSeeWidget('atRisk', ownerFull)).toBe(true);
    expect(canSeeWidget('atRisk', ownerEmpty)).toBe(false);
  });

  it('reviewQueue is only for owner in full state', () => {
    expect(canSeeWidget('reviewQueue', ownerFull)).toBe(true);
    expect(canSeeWidget('reviewQueue', { ...ownerFull, role: 'admin' })).toBe(false);
    expect(canSeeWidget('reviewQueue', { ...ownerFull, dataState: 'partial' })).toBe(false);
  });

  it('todaysClasses is only for hybrid schools in non-empty state', () => {
    expect(canSeeWidget('todaysClasses', ownerFull)).toBe(false);
    expect(canSeeWidget('todaysClasses', ownerHybridFull)).toBe(true);
    expect(canSeeWidget('todaysClasses', { ...ownerHybridFull, dataState: 'empty' })).toBe(false);
  });

  it('onboarding is hidden for editor and in full state', () => {
    expect(canSeeWidget('onboarding', ownerEmpty)).toBe(true);
    expect(canSeeWidget('onboarding', ownerFull)).toBe(false);
    expect(canSeeWidget('onboarding', { ...ownerEmpty, role: 'editor' })).toBe(false);
  });

  it('trialBanner is only for owner', () => {
    expect(canSeeWidget('trialBanner', ownerFull)).toBe(true);
    expect(canSeeWidget('trialBanner', teacherFull)).toBe(false);
  });

  it('teacherQueue is only for teacher', () => {
    expect(canSeeWidget('teacherQueue', teacherFull)).toBe(true);
    expect(canSeeWidget('teacherQueue', ownerFull)).toBe(false);
  });
});
