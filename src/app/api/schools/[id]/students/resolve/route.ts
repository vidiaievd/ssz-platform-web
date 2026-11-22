import { type NextRequest, NextResponse } from 'next/server';

import { lookupSchoolUser } from '@/lib/api/school-user-lookup';
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
    const user = await lookupSchoolUser(id, email);

    let branch: EmailResolveResult['branch'];
    if (!user.found) {
      branch = 'register';
    } else if (user.isStudent) {
      branch = 'attach-direct';
    } else {
      branch = 'onboard-existing';
    }

    const result: EmailResolveResult = user.found
      ? { branch, userId: user.userId, displayName: user.displayName ?? undefined }
      : { branch };
    return NextResponse.json(result);
  } catch (e) {
    // Never "register" on a failure: the address may well have an account.
    if (e instanceof AppError && e.code === 'rate_limited') {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    if (e instanceof AppError && e.code === 'not_found') {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }
    if (e instanceof AppError && e.code === 'conflict') {
      return NextResponse.json({ error: 'school_not_active' }, { status: 409 });
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
