import { type NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors/app-error';
import type { EmailResolveResult } from '@/features/students/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const email = req.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  try {
    const user = await serverFetch<{
      userId?: string;
      displayName?: string;
      roles?: string[];
    }>({
      service: 'organization',
      path: `/users/lookup`,
      query: { email, schoolId: id },
    });

    const hasStudentRole = user.roles?.some((r) =>
      r === 'student' || r === 'STUDENT',
    );

    let branch: EmailResolveResult['branch'];
    if (!user.userId) {
      branch = 'register';
    } else if (hasStudentRole) {
      branch = 'attach-direct';
    } else {
      branch = 'onboard-existing';
    }

    const result: EmailResolveResult = {
      branch,
      userId: user.userId,
      displayName: user.displayName,
    };
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') {
      const result: EmailResolveResult = { branch: 'register' };
      return NextResponse.json(result);
    }
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof AppError && e.code === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to resolve email' }, { status: 502 });
  }
}
