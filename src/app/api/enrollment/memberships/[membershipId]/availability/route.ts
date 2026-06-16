import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { AvailabilityPref } from '@/features/enrollment/types';

const DAY_TO_NUMBER: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
) {
  const { membershipId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { schoolId, prefs } = body as { schoolId?: string; prefs?: AvailabilityPref[] };

  if (!schoolId) return NextResponse.json({ error: '"schoolId" is required' }, { status: 400 });
  if (!Array.isArray(prefs)) return NextResponse.json({ error: '"prefs" must be an array' }, { status: 400 });

  const backendPrefs = prefs.map((p) => ({
    day: DAY_TO_NUMBER[p.day] ?? 1,
    from: p.from,
    to: p.to,
  }));

  try {
    await serverFetch({
      service: 'organization',
      path: `/schools/${schoolId}/memberships/${membershipId}/availability`,
      method: 'POST',
      body: { prefs: backendPrefs },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'not_found' ? 404 : e.code === 'forbidden' ? 403 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to submit availability' }, { status: 502 });
  }
}
