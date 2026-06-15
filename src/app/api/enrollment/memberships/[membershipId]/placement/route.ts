import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';
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

  const result = body as PlacementResult;
  if (!result?.language || !result?.cefrLevel || result?.score == null) {
    return NextResponse.json(
      { error: 'language, cefrLevel, and score are required' },
      { status: 400 },
    );
  }

  try {
    const provider = getEnrollmentProvider();
    const updated = await provider.submitPlacement(membershipId, result);
    return NextResponse.json(updated);
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'not_found' ? 404 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to submit placement' }, { status: 502 });
  }
}
