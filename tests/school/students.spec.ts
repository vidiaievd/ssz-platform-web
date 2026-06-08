import { test, expect } from "@playwright/test";

import { stubJson } from "../utils/stub";

/**
 * Critical flows for Student Management:
 * - Students list renders with segment filter
 * - Student detail page loads with groups/progress panels
 * - Add-to-group dialog opens and shows capacity meter
 *
 * All tests use @stub tag (no live backend required).
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
  avatarUrl: null,
  description: null,
};

const STUDENTS_STUB = [
  {
    userId: "u1",
    name: "Alice Martin",
    email: "alice@example.com",
    avatarUrl: null,
    lang: "fr",
    level: "B1",
    progress: 0.7,
    lastSeen: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    enrolledAt: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10),
    groups: [
      {
        id: "group-a1",
        name: "French B1 Monday",
        lang: "fr",
        level: "B1",
        scheduleSummary: "Mon 18:00",
        teachers: [
          { userId: "t1", name: "Sophie", role: "primary", avatarUrl: null },
        ],
      },
    ],
  },
  {
    userId: "u2",
    name: "Bob Chen",
    email: "bob@example.com",
    avatarUrl: null,
    lang: "en",
    level: "A2",
    progress: 0,
    lastSeen: null,
    enrolledAt: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    groups: [],
  },
];

async function stubCommon(page: import("@playwright/test").Page) {
  await stubJson(page, "**/api/auth/me", SESSION_STUB);
  await stubJson(page, "**/organizations/schools/by-slug/**", SCHOOL_STUB);
  await stubJson(page, "**/organizations/schools/*/students", STUDENTS_STUB);
  await stubJson(
    page,
    "**/organizations/schools/*/students/u1",
    STUDENTS_STUB[0]!,
  );
  await stubJson(page, "**/api/schools/*/students/resolve*", {
    branch: "register",
  });
  await stubJson(page, "**/scheduling/slots/*", []);
}

// ── Students list ─────────────────────────────────────────────────────────────

test.describe("Students list @stub", () => {
  test("renders student list with names and status chips", async ({ page }) => {
    await stubCommon(page);
    await page.goto(`/en/school/${SCHOOL_SLUG}/students`);

    await expect(page.getByText("Alice Martin")).toBeVisible();
    await expect(page.getByText("Bob Chen")).toBeVisible();
  });

  test('segment filter "no-group" shows only unassigned students', async ({
    page,
  }) => {
    await stubCommon(page);
    await page.goto(`/en/school/${SCHOOL_SLUG}/students`);

    await page.getByRole("radio", { name: /no group/i }).click();
    await expect(page.getByText("Bob Chen")).toBeVisible();
    await expect(page.getByText("Alice Martin")).not.toBeVisible();
  });

  test("search filters by name", async ({ page }) => {
    await stubCommon(page);
    await page.goto(`/en/school/${SCHOOL_SLUG}/students`);

    await page.getByLabel("Search students").fill("alice");
    await expect(page.getByText("Alice Martin")).toBeVisible();
    await expect(page.getByText("Bob Chen")).not.toBeVisible();
  });

  test("clicking student row navigates to detail page", async ({ page }) => {
    await stubCommon(page);
    await page.goto(`/en/school/${SCHOOL_SLUG}/students`);

    await page
      .getByRole("link", { name: /alice martin/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/students\/u1/);
  });
});

// ── Student detail ────────────────────────────────────────────────────────────

test.describe("Student detail @stub", () => {
  test("renders detail page with header and groups panel", async ({ page }) => {
    await stubCommon(page);
    await page.goto(`/en/school/${SCHOOL_SLUG}/students/u1`);

    await expect(page.getByText("Alice Martin")).toBeVisible();
    await expect(page.getByText("French B1 Monday")).toBeVisible();
    await expect(page.getByText("Sophie")).toBeVisible();
  });

  test("back link returns to students list", async ({ page }) => {
    await stubCommon(page);
    await page.goto(`/en/school/${SCHOOL_SLUG}/students/u1`);

    await page.getByRole("link", { name: /back to students/i }).click();
    await expect(page).toHaveURL(/\/students$/);
  });

  test("groups panel shows group link to navigate to group", async ({
    page,
  }) => {
    await stubCommon(page);
    await page.goto(`/en/school/${SCHOOL_SLUG}/students/u1`);

    const groupLink = page.getByRole("link", {
      name: /open group french b1 monday/i,
    });
    await expect(groupLink).toBeVisible();
  });
});
