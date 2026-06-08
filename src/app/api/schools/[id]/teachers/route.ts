import { type NextRequest, NextResponse } from 'next/server';

import { getSchedulingProvider } from '@/lib/scheduling/provider';
import { handleBffError } from '../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const provider = getSchedulingProvider();
    const data = await provider.commandCenter(id);
    return NextResponse.json(data.teachers);
  } catch (e) {
    return handleBffError(e, 'Failed to fetch teachers');
  }
}

type InviteBody = { email: string; maxWeeklyContactHours: number; employmentType: 'full' | 'part' | 'contract' };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: InviteBody;
  try {
    body = await req.json() as InviteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // 3-branch invite flow:
    //   1. User not found (404 from org-service) → send registration invite → branch: "register"
    //   2. User found, already has TEACHER role → add directly → branch: "added"
    //   3. User found, no TEACHER role → send onboarding invite → branch: "onboard"
    //
    // Stub: mock-implements branch 2 (direct add) until org-service is ready.
    void id;
    const name = body.email.split('@')[0] ?? body.email;
    return NextResponse.json({ branch: 'added', name }, { status: 201 });
  } catch (e) {
    return handleBffError(e, 'Failed to add teacher');
  }
}
