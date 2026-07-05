import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import { buildCommandCenter } from '@/lib/scheduling/command-center';
import { handleBffError } from '../_bff-helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { teachers } = await buildCommandCenter(id);
    return NextResponse.json(teachers);
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
    //   1. User not found → send registration invite → branch: "register"
    //   2. User found, has TEACHER role → add directly as school member → branch: "added"
    //   3. User found, no TEACHER role → send onboarding invite → branch: "onboard"

    let user: { userId?: string; displayName?: string; roles?: string[] } | null = null;
    try {
      user = await serverFetch<{ userId?: string; displayName?: string; roles?: string[] }>({
        service: 'organization',
        path: '/users/lookup',
        query: { email: body.email, schoolId: id },
      });
    } catch (e) {
      if (!(e instanceof AppError && e.code === 'not_found')) throw e;
    }

    const hasTeacherRole = user?.roles?.some((r) => r === 'TEACHER' || r === 'teacher');

    if (user?.userId && hasTeacherRole) {
      // Branch 2: add directly
      await serverFetch({
        service: 'organization',
        path: `/schools/${id}/members`,
        method: 'POST',
        body: { userId: user.userId, role: 'TEACHER' },
      }).catch(() => {
        // 409 = already a member, that's fine
      });
      return NextResponse.json(
        { branch: 'added', name: user.displayName ?? body.email.split('@')[0] },
        { status: 201 },
      );
    }

    // Branches 1 & 3: send invitation
    const kind = user?.userId ? 'onboard_existing' : 'register';
    await serverFetch({
      service: 'organization',
      path: `/schools/${id}/invitations`,
      method: 'POST',
      body: {
        email: body.email,
        role: 'TEACHER',
        kind,
        ...(user?.userId ? { recipientUserId: user.userId } : {}),
      },
    });
    return NextResponse.json(
      { branch: kind, email: body.email },
      { status: 201 },
    );
  } catch (e) {
    return handleBffError(e, 'Failed to add teacher');
  }
}
