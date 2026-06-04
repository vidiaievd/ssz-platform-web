import { type NextRequest, NextResponse } from "next/server";

import { serverFetch } from "@/lib/api/server-fetcher";
import { AppError } from "@/lib/errors";
import { getSchool } from "@/features/school/api/get-school";
import { getSchoolBySlug } from "@/features/school/api/get-school-by-slug";
import { readAccessToken } from "@/lib/auth/cookies";
import {
  fetchDashboardKpis,
  fetchAtRisk,
  fetchCourseHealth,
  fetchActivity,
} from "@/lib/dashboard/queries";
import type { DashboardCompositeResponse } from "@/lib/dashboard/types";
import {
  deriveViewerRole,
  deriveSchoolType,
  deriveDataState,
  computeOnboarding,
} from "@/features/dashboard/lib/derive";

type Params = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNAVAILABLE = { status: "unavailable" } as const;

import type { SchoolRole } from "@/features/school/types";

type MembersPayload = Array<{
  userId: string;
  role?: SchoolRole;
  joinedAt?: string;
}>;
type ContainersPayload = { items?: unknown[]; total?: number } | unknown[];
type ReviewPayload = { items?: unknown[]; total?: number } | unknown[];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // ── 1. Resolve slug → school ───────────────────────────────────────────────
  // Use the appropriate org-service endpoint depending on whether id is a UUID
  // or a slug: GET /api/v1/schools/{id} vs GET /api/v1/schools/by-slug/{slug}.
  const school = UUID_RE.test(id)
    ? await getSchool(id)
    : await getSchoolBySlug(id);

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const schoolId = school.id;

  // ── 2. Resolve viewer role ─────────────────────────────────────────────────
  // Prefer members[] already embedded in school detail. Fall back to a dedicated
  // members fetch if the school came from the list endpoint (no members[]).
  let schoolForRole = school;

  if (!school.members) {
    try {
      const membersRaw = await serverFetch<MembersPayload>({
        service: "organization",
        path: `/schools/${schoolId}/members`,
      });
      schoolForRole = {
        ...school,
        members: Array.isArray(membersRaw) ? membersRaw : [],
      };
    } catch {
      // TODO(backend): members fetch failed — role derivation will default to teacher
      schoolForRole = { ...school, members: [] };
    }
  }

  // Decode viewerUserId from the access token claim (sub)
  const token = await readAccessToken();
  let viewerUserId: string | undefined;
  if (token) {
    try {
      const part = token.split(".")[1] ?? "";
      const payload = JSON.parse(Buffer.from(part, "base64url").toString());
      viewerUserId = payload.sub as string | undefined;
    } catch {
      // malformed JWT — role will fallback
    }
  }

  const role = viewerUserId
    ? deriveViewerRole(schoolForRole, viewerUserId)
    : "teacher";

  // ── 3. School metadata ─────────────────────────────────────────────────────
  const schoolType = deriveSchoolType(school);

  // ── 4. Parallel analytics + org fetches ───────────────────────────────────
  const [
    kpis,
    atRisk,
    courseHealth,
    activity,
    membersResult,
    containersResult,
  ] = await Promise.all([
    fetchDashboardKpis(schoolId),
    fetchAtRisk(schoolId, 3),
    fetchCourseHealth(schoolId),
    fetchActivity(schoolId, 6),
    // Used to compute onboarding state + dataState
    fetchCount<MembersPayload>(() =>
      serverFetch({
        service: "organization",
        path: `/schools/${schoolId}/members`,
      }),
    ),
    fetchCount<ContainersPayload>(() =>
      serverFetch({
        service: "content",
        path: "/containers",
        query: { schoolId, limit: 1 },
      }),
    ),
    fetchCount<ReviewPayload>(() =>
      serverFetch({
        service: "progress",
        path: "/review/submissions/pending",
        query: { schoolId, limit: 1 },
      }),
    ),
  ]);

  // ── 5. Derive dataState ────────────────────────────────────────────────────
  const membersCount = membersResult ?? 1;
  const coursesCount = containersResult ?? 0;
  const hasActivity =
    "items" in activity &&
    Array.isArray(activity.items) &&
    activity.items.length > 0;

  const dataState = deriveDataState({
    membersCount,
    coursesCount,
    hasActivity,
  });

  // ── 6. Compute onboarding ──────────────────────────────────────────────────
  const hasPublishedLesson = coursesCount > 0; // simplified; TODO(backend): check published lessons count
  const hasPendingInvitation = false; // TODO(backend): check invitations endpoint
  const onboarding = computeOnboarding({
    school: { avatarUrl: school.avatarUrl, description: school.description },
    membersCount,
    coursesCount,
    groupsCount: 0, // TODO(backend): fetch groups count when groups service is available
    hasPublishedLesson,
    hasPendingInvitation,
    hasAssignedTeacher: false, // TODO(backend): fetch from groups service
  });

  const composite: DashboardCompositeResponse = {
    schoolId,
    role: role.toUpperCase(), // normalise to match analytics service convention
    kpis,
    atRisk,
    courseHealth,
    activity,
    todaysClasses: UNAVAILABLE, // TODO(backend): scheduling service — see backend-todo.md
    trial: UNAVAILABLE, // TODO(backend): billing service — see backend-todo.md
    onboarding,
    dataState,
    schoolType,
  };

  return NextResponse.json(composite);
}

// ─── Nudge action ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const data = await serverFetch({
      service: "analytics",
      path: `/analytics/schools/${id}/nudge`,
      method: "POST",
      body,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AppError && e.code === "unauthenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof AppError && e.code === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to nudge students" },
      { status: 502 },
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchCount<T>(fn: () => Promise<T>): Promise<number | null> {
  try {
    const data = await fn();
    if (Array.isArray(data)) return data.length;
    if (data && typeof data === "object") {
      if (
        "total" in data &&
        typeof (data as Record<string, unknown>).total === "number"
      ) {
        return (data as { total: number }).total;
      }
      if (
        "items" in data &&
        Array.isArray((data as Record<string, unknown>).items)
      ) {
        const items = (data as { items: unknown[] }).items;
        if ("total" in data) return (data as { total: number }).total;
        return items.length;
      }
    }
    return null;
  } catch {
    return null;
  }
}
