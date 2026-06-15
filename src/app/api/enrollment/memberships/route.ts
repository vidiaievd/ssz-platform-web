import { NextRequest, NextResponse } from 'next/server';
import { AppError, isAppError } from '@/lib/errors';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import type { MembershipSource } from '@/features/enrollment/types';
import type { LangCode } from '@/features/groups/types';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { schoolSlug, source, language } = body as {
    schoolSlug?: string;
    source?: MembershipSource;
    language?: LangCode;
  };

  if (!schoolSlug || !source || !language) {
    return NextResponse.json(
      { error: 'schoolSlug, source, and language are required' },
      { status: 400 },
    );
  }

  try {
    const provider = getEnrollmentProvider();
    const membership = await provider.createMembership({ schoolSlug, source, language });
    return NextResponse.json(membership, { status: 201 });
  } catch (e) {
    if (isAppError(e)) {
      const status = e.code === 'conflict' ? 409 : e.code === 'not_found' ? 404 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 502 });
  }
}
