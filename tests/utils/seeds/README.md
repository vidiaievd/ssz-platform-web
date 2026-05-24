# E2E Test Data Seeds

Playwright e2e tests run against the real backend for critical flow coverage.
This document describes how to start the backend in a seeded state.

---

## Prerequisites

- Docker and Docker Compose available
- Access to the `ssz-platform` backend monorepo
- `.env.e2e` file at the root of `ssz-platform` (copy from `.env.e2e.example`)

---

## Starting the backend with seed data

From the **`ssz-platform` repository root**:

```bash
# Start all services (auth, content, gateway, postgres, redis)
docker compose -f docker-compose.e2e.yml up -d

# Wait for services to be healthy, then run the seed script
npm run seed:e2e
```

The seed script creates the following test fixtures (credentials in `.env.e2e`):

| Role          | Email                        | Password         |
|---------------|------------------------------|------------------|
| School admin  | `school@e2e.test`            | `E2eSchool1!`    |
| Student       | `student@e2e.test`           | `E2eStudent1!`   |

Seeded content:
- One school: **"E2E Test School"** (slug `e2e-test-school`)
- One published container: **"E2E Test Course"** (slug `e2e-test-course`)
  - Three lessons, each with a vocabulary exercise

---

## Resetting state between runs

```bash
npm run seed:e2e --reset
```

This drops and re-creates all e2e schema data without restarting services.

---

## Hybrid mode (stubs for UI-only tests)

Tests that don't need real data use `tests/utils/stub.ts` helpers to intercept
`/api/*` BFF routes and serve canned responses. Those tests do not require the
backend to be running.

To run only stub-mode tests (no backend required):

```bash
E2E_STUB_ONLY=true npm run e2e -- --grep "@stub"
```

Tag stub-only tests with `@stub` in their title:

```ts
test('renders the dashboard @stub', async ({ page }) => { ... });
```

---

## CI

The GitHub Actions e2e workflow (`.github/workflows/e2e.yml`) starts the
backend via `docker compose` automatically before running Playwright.
See that file for the full setup sequence.
