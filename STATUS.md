# Project Status — ssz-platform-web

> Snapshot of what is implemented vs. what remains. Updated: 2026-05-24 (after CF-1…CF-3/CF-5 Course Management Flow).
> Source of truth for "where are we now". Source of truth for "where to next" is [`docs/plan/14-remaining-roadmap.md`](docs/plan/14-remaining-roadmap.md).

Legend:
- ✅ — implemented against the real backend
- 🟡 — implemented but uses mocked/stub data (UI ready, swap-in pending)
- ⚠️ — partial (some endpoints / states missing)
- ❌ — not implemented

---

## 1. Foundation, infrastructure, tooling

| Area | Status | Notes |
|---|---|---|
| TypeScript strict, ESLint, Prettier, Husky, lint-staged | ✅ | Phase 0 |
| Tailwind 4 + shadcn/ui + Lucide + Sonner + next-themes | ✅ | Phase 1 |
| next-intl with `en` / `nb` / `uk` / `ru`, locale resolver, switcher | ✅ | Phase 2 |
| TanStack Query, Zustand, RHF + Zod | ✅ | Phase 3 |
| OpenAPI / orval codegen | ⚠️ | Set up but only partial endpoints exposed from gateway |
| BFF layer (`serverFetch`, cookies, `tryAction`, `Result`) | ✅ | Phase 4, conventions in [`docs/conventions/bff.md`](docs/conventions/bff.md) |
| Storybook | ⚠️ | Initialised, coverage is uneven |
| Sentry, performance budgets, deploy config | ❌ | Phase 12 — deferred |

---

## 2. Auth Service `/api/v1/auth/`

| Endpoint | Status | Frontend touchpoint |
|---|---|---|
| POST `/auth/register` | ✅ | [`/[locale]/(auth)/register`](src/app/[locale]/(auth)/register) |
| POST `/auth/login` (incl. `mfaRequired` branch) | ✅ | [`/[locale]/(auth)/login`](src/app/[locale]/(auth)/login) |
| POST `/auth/mfa/challenge` | ✅ | Login flow |
| POST `/auth/mfa/backup` | ❌ | — |
| POST `/auth/refresh` | ✅ | Server-side, no BFF route exposed |
| POST `/auth/logout` | ✅ | Sidebar / topbar action |
| POST `/auth/password/forgot` | ✅ | [`/[locale]/(auth)/forgot-password`](src/app/[locale]/(auth)/forgot-password) |
| POST `/auth/password/reset` | ✅ | [`/[locale]/(auth)/reset-password`](src/app/[locale]/(auth)/reset-password) |
| POST `/auth/email/verify/request` | ✅ | Verify email page |
| POST `/auth/email/verify/confirm` | ✅ | [`/[locale]/(auth)/verify-email`](src/app/[locale]/(auth)/verify-email) |
| GET `/auth/roles` | ✅ | [`/api/auth/me`](src/app/api/auth/me/route.ts) |
| POST `/auth/roles` (assign role) | ❌ | — |
| POST `/auth/2fa/setup` | ❌ | — |
| POST `/auth/2fa/verify` | ❌ | — |
| DELETE `/auth/2fa` | ❌ | — |

**Pages:** register, login, forgot-password, reset-password, verify-email — all wired to backend.

---

## 3. User Profile Service `/api/v1/profiles/`

| Endpoint | Status | Frontend touchpoint |
|---|---|---|
| GET `/profiles/me` | ✅ | [`/api/profile/me`](src/app/api/profile/me/route.ts) |
| PATCH `/profiles/me` | ✅ | Settings → profile page |
| DELETE `/profiles/me` | ❌ | — |
| POST/GET `/profiles/me/student` | ❌ | No onboarding flow yet |
| POST/DELETE `/profiles/me/student/languages` | ❌ | — |
| POST `/profiles/me/tutor` | ❌ | — |
| POST/DELETE `/profiles/me/tutor/languages` | ❌ | — |
| GET `/profiles/tutors` | ❌ | — |
| GET `/profiles/{userId}` (+ `/student`, `/tutor`) | ❌ | — |

**Pages:** `student/settings/profile`, `school/settings/profile` — base profile only.

---

## 4. Organization Service `/api/v1/schools/`

| Endpoint | Status | Frontend touchpoint |
|---|---|---|
| GET schools discovery (composite) | ✅ | [`/api/discovery/schools`](src/app/api/discovery/schools/route.ts), used by catalogue pages |
| POST `/schools` (create) | ❌ | — |
| GET `/schools` (my schools) | ❌ | — |
| GET `/schools/{id}` | ❌ | — |
| PATCH `/schools/{id}` | ❌ | — |
| DELETE `/schools/{id}` | ❌ | — |
| POST `/schools/{id}/members` | ❌ | — |
| DELETE `/schools/{id}/members/{userId}` | ❌ | — |
| POST `/schools/{id}/invitations` | ❌ | — |
| POST `/schools/invitations/{token}/accept` | ❌ | — |

**Pages:** marketing catalogue (`/(marketing)/catalogue`) and a school dashboard stub. No school CRUD, no member management.

---

## 5. Content Service `/api/v1/`

### Read

| Area | Status |
|---|---|
| Containers: GET list, by id, by slug | ✅ |
| Containers: items (GET) | ✅ |
| Lessons: GET, GET variants, GET best variant | ✅ |
| Exercises: GET (display) | ✅ |
| Vocabulary lists: GET list/items/single item | ✅ |
| Grammar rules: GET + explanations (list / best) | ✅ |
| Tags: GET / suggestions | ✅ |
| Shares: GET | ✅ |
| `GET /me/entitlements` | ❌ |

### Write (authoring)

| Area | Status |
|---|---|
| Container create/update | ✅ |
| Container items add/update/delete/reorder | ✅ |
| Lesson create/update | ✅ |
| Lesson variant create/update | ⚠️ (publish action missing) |
| Exercise create/update | ✅ |
| Exercise instructions CRUD | ❌ |
| Vocabulary list create/update | ✅ |
| Vocabulary item add (single / bulk) / update / delete / reorder | ⚠️ (bulk + reorder UI not built) |
| Vocabulary translations (`PUT/DELETE …/translations/{lang}`) | ❌ |
| Vocabulary examples + translations | ❌ |
| Grammar rule create/update | ✅ |
| Grammar explanations create/update/publish | ⚠️ (publish missing) |
| Grammar pool (POST/GET/PATCH/DELETE/random/reorder) | ❌ |
| Tags create/update/delete + assign/unassign | ✅ |
| Shares create/delete | ✅ |
| Container publish (`POST …/publish`) | ✅ |
| Container unpublish / archive / restore | 🟡 BFF routes exist, return 501 pending backend support |
| Container duplicate | 🟡 BFF route exists, returns 501 |
| Container pre-flight checks | ✅ `runPreflight()` pure fn + `/api/content/containers/[id]/preflight` BFF route |
| Container activity feed | 🟡 BFF route exists, returns empty list |
| Container localizations | ❌ |
| Container entitlements (grant / revoke / list) | ❌ |

### Course Management Flow (CF-1…CF-5)

| Feature | Status | Notes |
|---|---|---|
| CF-1 Course list — search, sort, state filters + counts | ✅ | `useMyContainers` page-based query; URL-synced filters via `useUrlFilters` |
| CF-1 Table / Grid toggle, bulk action bar | ✅ | Owner/admin only; bulk delete/archive stubbed |
| CF-1 Empty state with on-ramp templates | ✅ | Shown when no courses at all |
| CF-3 Course detail — breadcrumb, status banner, state badge | ✅ | Preflight counts fetched server-side for draft |
| CF-3 Overview two-column layout (form + sidebar) | ✅ | Right sidebar: PreflightPanel + DangerZone |
| CF-3 Danger zone — discard draft, unpublish, archive, restore, delete forever | ⚠️ | Publish ✅; unpublish/archive/restore → 501 toast |
| CF-4 Three-state lifecycle (draft / published / archived) | ⚠️ | `ContainerState` type + `deriveContainerState` in place; `archived` state pending backend `isArchived` field |
| CF-5 Pre-flight panel — blockers, warnings, fix links, publish anyway | ✅ | Client-side `runPreflight()` used both in BFF route and wizard |
| CF-2 5-step Create Wizard | ❌ | Next: Step F |

**Pages:** [`/[locale]/school/content`](src/app/[locale]/school/content) — list with filters/search, [`/new`] simple form (wizard pending), [`/[id]`] full editor with status banner + danger zone.

---

## 6. Media Service `/api/v1/media/`

| Endpoint | Status |
|---|---|
| POST `/media/uploads/request` | ❌ |
| POST `/media/uploads/{id}/finalize` | ❌ |
| GET `/media/assets` | ❌ |
| GET `/media/assets/{id}` | ❌ |
| DELETE `/media/assets/{id}` | ❌ |

**Consequence:** no avatar upload, no media for lessons/exercises.

---

## 7. Exercise Engine `/api/v1/exercises/{id}/attempts`

| Endpoint | Status |
|---|---|
| POST `/exercises/{id}/attempts` (start) | 🟡 Local simulation only |
| POST `/exercises/{id}/attempts/{id}/submit` | 🟡 Local scoring on the client |
| GET `/exercises/{id}/attempts` | ❌ |
| GET `/exercises/{id}/attempts/{id}` | ❌ |
| DELETE `/exercises/{id}/attempts/{id}` | ❌ |

**Frontend:** [`src/features/student/exercises/`](src/features/student/exercises) — cloze, multiple-choice, free-text render and grade client-side; nothing is persisted.

---

## 8. Learning Service

| Area | Status | Note |
|---|---|---|
| GET `/api/student/progress` (composite) | 🟡 | Mock in [`/api/student/progress`](src/app/api/student/progress/route.ts) |
| GET `/api/student/streak` | 🟡 | Mock |
| GET `/api/student/upcoming` | 🟡 | Mock |
| GET `/api/enrollment/requests` | 🟡 | Mock in [`/api/enrollment/requests`](src/app/api/enrollment/requests/route.ts) |
| POST `/api/v1/progress` (record progress) | ❌ | Lesson start/complete events stubbed |
| GET `/api/v1/progress/{type}/{id}` | ❌ | |
| PATCH `…/flag` and `…/resolve` | ❌ | |
| POST `/api/v1/enrollments` | ❌ | |
| GET `/api/v1/enrollments` + `/{id}` | ❌ | |
| DELETE `/api/v1/enrollments/{id}` | ❌ | |
| PATCH `/api/v1/enrollments/{id}/complete` | ❌ | |
| Assignments — full suite (`/api/v1/assignments/*`) | ❌ | Not implemented at all |
| Review submissions — full suite (`/api/v1/review/submissions/*`) | ❌ | Not implemented at all |
| SRS — full suite (`/api/v1/srs/*`) | ❌ | Not implemented at all |

---

## 9. Notifications

| Endpoint | Status |
|---|---|
| GET `/api/notifications` | 🟡 Mock in [`/api/notifications`](src/app/api/notifications/route.ts) |
| Mark read / read-all | ❌ |
| Delete | ❌ |
| Preferences | ❌ |
| Real-time delivery | ❌ |

**Frontend:** notification bell in topbar with badge — UI in place, no real data.

---

## 10. Pages — quick map

### Marketing
- ✅ `/(marketing)/catalogue` — list of schools/tutors (filters)
- ✅ `/(marketing)/catalogue/[slug]` — school detail

### Auth
- ✅ `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`

### Student
- ✅ `/student/dashboard` — widgets (uses mocked progress / streak / upcoming)
- ✅ `/student/discover` — discover schools
- ✅ `/student/enrolled` — enrolled overview
- ✅ `/student/enrolled/lessons/[id]` — lesson player with navigation, exercise router
- ✅ `/student/enrolled/requests` — enrollment requests list (mocked)
- ✅ `/student/lessons` — lessons listing
- ✅ `/student/settings/{profile, account, notifications}` — base settings
- ❌ Student onboarding (post-register: create student profile, target language)
- ❌ Real assignment list / detail
- ❌ SRS review page
- ❌ Submissions list / detail (free-text answers awaiting review)

### School / Tutor
- ✅ `/school/dashboard` — basic stub
- ✅ `/school/content` — course list with search, state filters, sort, table/grid, bulk actions
- ✅ `/school/content/new` — create form (5-step wizard pending)
- ✅ `/school/content/[id]` — editor with breadcrumb, status banner, preflight panel, danger zone
- ✅ `/school/students` — students list (basic)
- ✅ `/school/settings/{profile, account, notifications}`
- ❌ Create / manage a school (Organization Service not wired)
- ❌ Members & invitations
- ❌ Assignments hub (create, track)
- ❌ Submissions review queue
- ⚠️ Container publish flow — publish ✅, unpublish/archive/restore pending backend
- ❌ 5-step Create Wizard (CF-2)
- ❌ Vocabulary translations / examples editors
- ❌ Grammar pool management

---

## 11. Cross-cutting

| Concern | Status |
|---|---|
| Loading / empty / error states per screen | ⚠️ — uneven |
| Storybook coverage | ⚠️ — early |
| Unit tests (Vitest + RTL) | ⚠️ — sparse |
| MSW handlers | ⚠️ — partial |
| Playwright e2e | ❌ |
| a11y audit pass (axe + manual SR) | ❌ |
| Sentry, perf budgets, prod deploy | ❌ |
| Russian/Ukrainian/Norwegian message catalogues completeness | ⚠️ — keys present for shipped surfaces, will need expansion per new flow |

---

## Recent work (context)

Last committed stream (`feature/student-experience` branch — student experience MVP):
```
5cf15b9 feat(student): design system alignment — stat/course/lesson cards, sidebar logo, dashboard page
c7255ff feat(student): notifications bell, VoxOrd promo, exercise tests
02eeb98 feat(student): exercise interaction
8d71ea0 feat(student): lesson player with navigation
3a95c9c feat(student): enrolled dashboard
```

In-progress (uncommitted, same branch — Course Management Flow):
- Step A — foundation types, `slugify`, `Stepper`, `ContainerStateBadge`
- Step B — CF-1 course list (search, filters, sort, table/grid, bulk, pagination)
- Step C — BFF lifecycle routes (archive/restore/unpublish/duplicate/preflight/activity)
- Step D — CF-5 `runPreflight()` + `PreflightPanel`
- Step E — CF-3 detail page (breadcrumb, status banner, two-column overview, danger zone)
- **Step F pending** — CF-2 5-step Create Wizard

---

## What "done" means today

The **student experience MVP loop** works end-to-end visually: register → log in → browse catalogue → discover → enrol (mocked) → enrolled dashboard (mocked progress) → lesson player → answer exercises (local scoring).

The **school/content authoring** side covers: full read/write of containers, lessons, exercises, vocabulary lists, grammar rules, tags, shares against the real backend — plus the Course Management Flow (CF-1 list with filters, CF-3 detail with danger zone, CF-5 preflight). The 5-step Create Wizard (CF-2) is the immediate next step.

Everything else listed as ❌ or 🟡 is the gap that turns the demo into a working product. The roadmap is in [`docs/plan/14-remaining-roadmap.md`](docs/plan/14-remaining-roadmap.md).
