# CLAUDE.md — ssz-platform-web

> Guidance for Claude Code when working on the **ssz-platform-web** repository.
> This file is the source of truth for project context, architectural standards, and working agreements.
> Detailed step-by-step development plans live in `docs/plan/`.

---

## 1. Project overview

**ssz-platform-web** is the web client for the `ssz-platform` — an EdTech platform for private tutors and language schools and their students.

### High-level architecture

- **Backend:** microservices monorepo `ssz-platform` (separate repository), services in C#/ASP.NET Core and NestJS
- **Mobile:** React Native app `VoxOrd` for students learning Norwegian vocabulary (separate repository)
- **Web (this repository):** single Next.js application serving three audiences via Route Groups:
  - Schools / tutors (content authors, school admins)
  - Enrolled students (full learning experience)
  - Non-enrolled students (limited / public learning experience)
- **API Gateway:** planned, to be designed in a separate effort. Until it exists, the web BFF talks directly to microservices over the internal Docker network.

### Audience routing model

A single Next.js application uses **App Router Route Groups** to provide distinct experiences without separate deployments:

```
src/app/
├── (marketing)/   # public pages (landing, pricing)
├── (auth)/        # login, register, password recovery
├── (school)/      # schools and tutors workspace
├── (student)/     # students workspace; enrolled features in (student)/enrolled/
└── layout.tsx
```

Two student tiers (enrolled vs not) are handled as **functional gating inside `(student)/`**, not as a separate route group.

---

## 2. Tech stack

### Core
- **Next.js 16.2.4** with **App Router** (Server Components, Server Actions)
- **React 19.2**
- **TypeScript 5** (strict mode)

### Styling & UI
- **Tailwind CSS 4**
- **shadcn/ui** as the component primitives layer
- **Lucide** icons
- **Sonner** for toasts
- **Framer Motion** (`motion`) for non-trivial animations
- **next-themes** for light/dark/system theming

### State & data
- **TanStack Query** for server state (caching, mutations, optimistic updates)
- **Zustand** for client state (UI state, filters, multi-step forms)
- **React Hook Form** + **Zod** for forms and validation

### API integration
- **OpenAPI → TypeScript** code generation from the backend's aggregated Swagger (`api-docs-service`). Tooling: **orval** (generates TanStack Query hooks from OpenAPI).
- **BFF layer** in Next.js Route Handlers / Server Actions
- Tokens (access + refresh) stored in **httpOnly cookies**, never exposed to client-side JS

### Internationalisation
- **next-intl**
- Supported locales: `en`, `nb` (Norwegian Bokmål), `uk` (Ukrainian), `ru` (Russian)
- Locale codes are language-only, no region (`ru`, not `ru-RU`)
- No flags in the language selector. Languages are displayed by their endonym: `English`, `Norsk`, `Українська`, `Русский`
- Default locale resolution: Norway → `nb`, Ukraine → `uk` (even when `Accept-Language: ru`), elsewhere → `en`. The user can always override.
- Russian is supported with full respect: no Russian state symbolism anywhere in the platform; "language of instruction" inside school/course metadata is a separate concept from UI locale.

### Testing
- **Vitest** + **React Testing Library** for unit and integration tests
- **MSW (Mock Service Worker)** for API mocking
- **Playwright** for end-to-end tests
- **Storybook** for isolated UI development and visual regression

### Quality gates
- **ESLint** + **Prettier**
- **Husky** + **lint-staged** for pre-commit hooks
- TypeScript `strict: true`, no implicit `any`
- All commits must pass: typecheck, lint, unit tests

### Observability
- **Sentry** for error monitoring (added in production-readiness phase)

### Deployment (planned)
- **Frontend:** Vercel (production + preview deployments)
- **Backend:** separate concern (currently planned on Hetzner Cloud)

---

## 3. Architectural standards

### Project layout

```
src/
├── app/                       # Next.js App Router
│   ├── (marketing)/
│   ├── (auth)/
│   ├── (school)/
│   ├── (student)/
│   ├── api/                   # BFF route handlers
│   └── layout.tsx
├── components/
│   ├── ui/                    # shadcn primitives (do not edit by hand outside of shadcn add)
│   └── shared/                # cross-feature shared components
├── features/                  # feature-scoped code (see "Feature-Sliced layout" below)
│   ├── auth/
│   ├── profile/
│   ├── content/
│   └── ...
├── lib/                       # framework-agnostic utilities
│   ├── api/                   # api client setup, generated types
│   ├── i18n/                  # next-intl config
│   ├── auth/                  # cookie/token utilities (server-only)
│   └── utils/
├── hooks/                     # generic reusable hooks
├── stores/                    # Zustand stores (client state)
├── styles/                    # global styles, tailwind config extensions
└── types/                     # global type definitions
```

### Feature-Sliced layout

Each feature folder under `src/features/<feature>/` follows a consistent structure:

```
features/<feature>/
├── api/             # query keys, query/mutation hooks (wrap generated client)
├── components/      # feature-specific components
├── hooks/           # feature-specific hooks
├── schemas/         # Zod schemas
├── stores/          # feature-specific Zustand stores (if needed)
├── types/           # feature-specific types
└── index.ts         # public API of the feature (barrel export)
```

Cross-feature imports go through the `index.ts` barrel only.

### Server vs Client components

- **Default to Server Components.** Add `"use client"` only when actually needed (state, effects, browser APIs, event handlers).
- Data fetching for initial render → Server Component or Server Action.
- Real-time / interactive data → TanStack Query in Client Components.
- Forms with validation → Client Component (React Hook Form), submission via Server Action when possible.

### BFF layer rules

- All requests from the browser go to `/api/*` (Route Handlers) **or** are made server-side from Server Components / Server Actions.
- The browser never holds long-lived secrets. Access and refresh tokens live in httpOnly + secure + sameSite=lax cookies.
- The BFF layer attaches authentication and forwards calls to the API Gateway (or directly to microservices until the Gateway exists).
- Composite endpoints (data from multiple services for a single screen) live in the BFF, not on the client.

### Error handling

- API errors are surfaced as typed `Result<T, E>`-style returns from BFF handlers; UI never sees raw HTTP errors.
- Forms map server-side validation errors back to React Hook Form fields.
- Unexpected errors → Sentry + user-friendly toast via Sonner.

### Accessibility

- All interactive components must be keyboard navigable.
- Use shadcn primitives — they ship with Radix accessibility baked in.
- Run `eslint-plugin-jsx-a11y` checks in CI.
- Test focus management for modals, dialogs, route transitions.

### Performance budgets

- LCP < 2.5s on a mid-range mobile device on 4G.
- Initial JS payload (per route) < 200KB gzipped.
- No client-side data fetching waterfalls; prefer parallel `Promise.all` in Server Components.

---

## 4. Working agreements with Claude Code

These rules are non-negotiable. Claude Code must follow them on every step.

### Step granularity

- **One step = one logical commit.** A step is small enough that the developer can review, test, and commit it in isolation.
- A step has a clear `Goal`, the files it creates/modifies, a `Verification` section, and a suggested `Commit message`.
- If a task feels larger than one logical commit, **split it before starting**.

### Dependency installation

- **Never run `npm install`, `npm i`, `yarn add`, `pnpm add` automatically.**
- When a step requires new dependencies, list the exact command (e.g. `npm install -D vitest @vitejs/plugin-react`) and **wait for the developer to run it manually**.
- Distinguish runtime (`-S`) vs dev (`-D`) dependencies in every command.

### File creation

- Always show the full file content for new files.
- For modifications, show a clear diff or the full updated file.
- Do not edit files outside the scope of the current step.

### Verification

Every step must end with explicit verification instructions, for example:
- "Run `npm run dev` and visit `/login`. The form should render."
- "Run `npm run test`. The new test file should pass."
- "Run `npm run typecheck`. There must be 0 errors."

### Commits

- Use **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:`).
- One step → one commit. Suggest the commit message at the end of each step.

### Branching

- `master` — production
- `dev` — integration branch
- `feature/<name>` — feature branches off `dev`
- PRs go through GitHub CLI (`gh pr create`)

### Plan adherence

- The development plan lives in `docs/plan/`. Each phase is a separate file.
- Steps are completed in order unless the developer explicitly requests a reorder.
- If a step reveals that the plan is wrong, **stop and discuss before deviating**.

### Don'ts

- Don't introduce a new library without it being in the plan or explicitly approved.
- Don't generate boilerplate that does not pass typecheck and lint.
- Don't write tests that pass trivially (e.g. asserting that a component renders without checking anything meaningful).
- Don't suppress errors or warnings to make a step "work".

---

## 5. Quality bar

This project prioritises **quality and UX over speed**. The developer is solo, working with Claude Code.

- Every feature must be keyboard-accessible and themable.
- Every form must validate on the client and on the server.
- Every screen must have loading, empty, and error states.
- Every public-facing string must be translatable.
- Every component should be added to Storybook when it has visual variants.
- Every BFF endpoint must have an integration test.
- Every critical user flow must have an end-to-end Playwright test.

---

## 6. Reference

- Development plan overview: [`docs/plan/00-overview.md`](docs/plan/00-overview.md)
- Phase files: `docs/plan/01-*.md` through `docs/plan/12-*.md`
