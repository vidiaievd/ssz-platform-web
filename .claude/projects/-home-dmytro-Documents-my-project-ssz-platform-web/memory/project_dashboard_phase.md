---
name: project-dashboard-phase
description: School dashboard implementation progress on feature/dashboard branch
metadata:
  type: project
---

Phases 1–6 of the school dashboard (`docs/plan/school-dashboard/`) completed on `feature/dashboard` branch as of 2026-06-03.

**What was built:**
- Phase 1: Data contract types, role matrix (`lib/roles.ts`), derive logic (`lib/derive.ts`), BFF composite `GET /api/schools/[id]/dashboard`, analytics service wired into `env.ts`/`services.ts`, RSC fetcher + nudge action + barrel
- Phase 2: `userId` in CurrentUser, per-school role derived in `SchoolInstanceLayout`, AppShell `schoolContext` prop, sidebar role gating + disabled lock + school-type pill, SchoolSwitcher client island
- Phase 3: `WidgetCard`, `Sparkline`, `KpiCard`, `StatusPill`, `RolePill`, `WidgetEmptyState`
- Phase 4: KPI strip, ActivityFeed + ActivityFilters, OnboardingChecklist, QuickActions, TipCard, TrialBanner
- Phase 5: CourseHealth, AtRiskList + NudgeAllButton (optimistic), ReviewQueueCard, TodaysClassesCard, TeacherQueueCard
- Phase 6: `page.tsx` RSC orchestration (parallel fetches, `WidgetResult<T>` → `WidgetData<T>` adapters), `loading.tsx` skeleton, `error.tsx` boundary

**What remains (Phase 7):**
- i18n strings (`Dashboard.school.*` keys in all 4 locales)
- a11y audit pass
- Storybook stories for all widgets
- Playwright e2e happy-path test

**Why:** Phase 7 (i18n/a11y/tests/Storybook) is next per `docs/plan/school-dashboard/07-i18n-a11y-tests.md`.

**How to apply:** Resume with Phase 7 in the next session.
