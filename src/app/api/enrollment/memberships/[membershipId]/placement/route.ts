import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { serverFetch } from '@/lib/api/server-fetcher';
import type { PlacementResult } from '@/features/enrollment/types';

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

  const { schoolId, language, cefrLevel, score, takenAt, scope, sourceLabel } = body as {
    schoolId?: string;
  } & Partial<PlacementResult>;

  if (!schoolId) return NextResponse.json({ error: '"schoolId" is required' }, { status: 400 });
  if (!language || !cefrLevel || score == null) {
    return NextResponse.json(
      { error: 'language, cefrLevel, and score are required' },
      { status: 400 },
    );
  }

  try {
    const result = await serverFetch<PlacementResult>({
      service: 'organization',
      path: `/schools/${schoolId}/memberships/${membershipId}/placement`,
      method: 'POST',
      body: { language, cefrLevel, score, takenAt, scope, sourceLabel },
    });
    return NextResponse.json(result);
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'not_found' ? 404 : e.code === 'forbidden' ? 403 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to submit placement' }, { status: 502 });
  }
}
