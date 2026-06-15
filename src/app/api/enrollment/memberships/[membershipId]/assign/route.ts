import { NextRequest, NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';

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

  const { groupId } = body as { groupId?: string };
  if (!groupId) {
    return NextResponse.json({ error: '"groupId" is required' }, { status: 400 });
  }

  try {
    const provider = getEnrollmentProvider();
    const updated = await provider.assignToGroup(membershipId, groupId);
    return NextResponse.json(updated);
  } catch (e) {
    if (isAppError(e)) {
      const status =
        e.code === 'conflict' ? 409
        : e.code === 'not_found' ? 404
        : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to assign to group' }, { status: 502 });
  }
}
