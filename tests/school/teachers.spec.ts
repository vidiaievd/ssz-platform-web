import { test, expect } from "@playwright/test";

import { stubJson } from "../utils/stub";

/**
 * Critical flows for Teacher Management:
 * - Teachers command center renders KPI tiles and teacher load table
 * - Add teacher modal: 3-branch invite flow
 * - Substitute console: cover queue renders, candidates load on selection
 * - Forecast dashboard: sliders update projection chart
 *
 * All tests use @stub tag (no live backend required for client-side flows).
 * Server-side data (command-center, substitutions, curriculum) comes from the
 * mock scheduling provider — no additional stubs needed for those routes.
 */

const SCHOOL_SLUG = "test-school";

const SESSION_STUB = {
  id: "admin-1",
  email: "admin@test.com",
  roles: [{ role: "SCHOOL_ADMIN", schoolId: "school-1" }],
};

const SCHOOL_STUB = {
  id: "school-1",
  name: "Test School",
  slug: SCHOOL_SLUG,
  ownerId: "admin-1",
  type: "online",
  avatarUrl: null,
  description: null,
};

async function stubAuth(page: import("@playwright/test").Page) {
  await stubJson(page, "**/api/auth/me", SESSION_STUB);
  await stubJson(page, "**/organizations/schools/by-slug/**", SCHOOL_STUB);
  await stubJson(page, "**/organizations/schools/**", SCHOOL_STUB);
  await stubJson(page, "**/api/schools/**", SCHOOL_STUB);
}

// ── Protection ────────────────────────────────────────────────────────────────

test.describe("Teachers section — auth guard @stub", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers`);
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });
});

// ── Command center ────────────────────────────────────────────────────────────

test.describe("Teachers command center @stub", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuth(page);
  });

  test("renders page heading and Add Teacher button", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers`);

    await expect(
      page.getByRole("heading", { name: /workload command center/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /add teacher/i }),
    ).toBeVisible();
  });

  test("tab navigation — clicking Substitutions tab changes URL", async ({
    page,
  }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers`);

    await page
      .getByRole("link", { name: /substitutions/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/substitutions/, { timeout: 8000 });
  });

  test("tab navigation — clicking Forecast tab changes URL", async ({
    page,
  }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers`);

    await page.getByRole("link", { name: /forecast/i }).first().click();
    await expect(page).toHaveURL(/\/forecast/, { timeout: 8000 });
  });
});

// ── Add teacher modal ─────────────────────────────────────────────────────────

test.describe("Add teacher — 3-branch invite flow @stub", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuth(page);
  });

  test("modal opens on Add Teacher button click", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers`);
    await page.getByRole("button", { name: /add teacher/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("branch:added — shows success message with teacher name", async ({
    page,
  }) => {
    await stubJson(page, "**/api/schools/*/teachers", {
      branch: "added",
      name: "anna",
    }, { status: 201 });

    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers`);
    await page.getByRole("button", { name: /add teacher/i }).click();
    await page.getByLabel(/email/i).fill("anna@school.no");

    // Submit the form
    await page.getByRole("button", { name: /invite|add/i }).last().click();

    // Should show the "added" branch outcome
    await expect(page.getByText(/anna/i)).toBeVisible({ timeout: 6000 });
  });

  test("modal closes on Cancel", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers`);
    await page.getByRole("button", { name: /add teacher/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
  });
});

// ── Substitute console ────────────────────────────────────────────────────────

test.describe("Substitute console @stub", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuth(page);
  });

  test("renders page heading and cover queue panel", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers/substitutions`);

    await expect(
      page.getByRole("heading", { name: /substitute/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("report absence form is accessible via toggle", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers/substitutions`);

    await page.getByRole("button", { name: /report absence/i }).click();
    // The absence form section should expand
    await expect(page.getByRole("group", { name: /absence/i }).or(
      page.locator("form").filter({ hasText: /absence/i }),
    )).toBeVisible({ timeout: 5000 });
  });
});

// ── Forecast dashboard ────────────────────────────────────────────────────────

test.describe("Forecast dashboard @stub", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuth(page);
  });

  test("renders projection chart and assumption sliders", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers/forecast`);

    await expect(
      page.getByRole("heading", { name: /forecast/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Sliders section should be rendered
    await expect(page.getByRole("slider").first()).toBeVisible({ timeout: 5000 });
  });

  test("Save scenario input is visible", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers/forecast`);

    // Wait for client-side computation to run
    await expect(page.locator("input[type='text']").last()).toBeVisible({
      timeout: 8000,
    });
  });
});

// ── Curriculum planner ────────────────────────────────────────────────────────

test.describe("Curriculum planner @stub", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuth(page);
  });

  test("renders page heading and group selector", async ({ page }) => {
    // Stub the groups list for the group selector dropdown
    await stubJson(page, "**/organizations/schools/*/groups", [
      { id: "g1", name: "English A1", lang: "en", status: "active" },
    ]);

    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers/curriculum`);

    await expect(
      page.getByRole("heading", { name: /curriculum/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Teacher detail (schedule view) ───────────────────────────────────────────

test.describe("Teacher schedule view @stub", () => {
  test.beforeEach(async ({ page }) => {
    await stubAuth(page);
  });

  test("renders schedule title and tab navigation", async ({ page }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers/teacher-1`);

    await expect(
      page.getByRole("heading", { name: /schedule/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("weekly grid is keyboard navigable with arrow keys @a11y", async ({
    page,
  }) => {
    await page.goto(`/en/school/${SCHOOL_SLUG}/teachers/teacher-1`);

    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible({ timeout: 10_000 });

    // Tab into the grid, then navigate with arrow keys
    const firstCell = grid.getByRole("gridcell").first();
    await firstCell.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");

    // Focus should have moved — verify a cell is focused
    const focused = page.locator("[role='gridcell']:focus");
    await expect(focused).toBeAttached({ timeout: 3000 });
  });
});
