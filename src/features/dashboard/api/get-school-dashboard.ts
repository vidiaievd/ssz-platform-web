import 'server-only';

import type { DashboardCompositeResponse } from '@/lib/dashboard/types';

/**
 * RSC fetcher for the dashboard BFF composite.
 * Calls the internal Next.js route handler so all analytics/org fetches
 * run server-side with shared httpOnly-cookie auth.
 *
 * Revalidation is handled per-widget inside the BFF (see route.ts).
 * Page-level callers should wrap this in Suspense.
 */
export async function getSchoolDashboard(
  schoolId: string,
  baseUrl: string,
): Promise<DashboardCompositeResponse> {
  const url = `${baseUrl}/api/schools/${schoolId}/dashboard`;
  const res = await fetch(url, {
    // Always re-fetch — individual widgets have their own cache tags
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Dashboard fetch failed: ${res.status}`);
  }

  return res.json() as Promise<DashboardCompositeResponse>;
}
