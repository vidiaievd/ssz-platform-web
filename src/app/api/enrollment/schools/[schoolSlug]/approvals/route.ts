import { NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolSlug: string }> },
) {
  const { schoolSlug } = await params;

  try {
    const provider = getEnrollmentProvider();
    const items = await provider.listPendingApprovals(schoolSlug);
    return NextResponse.json({ items });
  } catch (e) {
    if (isAppError(e)) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'Failed to fetch pending approvals' }, { status: 502 });
  }
}
