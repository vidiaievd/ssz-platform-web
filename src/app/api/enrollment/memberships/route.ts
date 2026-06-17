import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError, isAppError } from '@/lib/errors';
import type { PublicSchool } from '@/features/school/api/get-public-school';
import type { MembershipSource, MembershipStatus } from '@/features/enrollment/types';
import type { LangCode, ISODate } from '@/features/groups/types';

type BackendMembership = {
  id: string;
  schoolId: string;
  status: MembershipStatus;
  source: MembershipSource;
  language?: string;
  createdAt: string;
};

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

  if (!schoolSlug || !source) {
    return NextResponse.json({ error: 'schoolSlug and source are required' }, { status: 400 });
  }

  try {
    // Resolve slug → schoolId via the public endpoint (no auth required).
    const school = await serverFetch<PublicSchool>({
      service: 'organization',
      path: `/schools/public/${schoolSlug}`,
      anonymous: true,
    });

    const membership = await serverFetch<BackendMembership>({
      service: 'organization',
      path: `/schools/${school.schoolId}/memberships`,
      method: 'POST',
      body: { source, language },
    });

    return NextResponse.json(
      {
        id: membership.id,
        schoolId: membership.schoolId,
        schoolSlug,
        schoolName: school.schoolName,
        status: membership.status,
        source: membership.source,
        language: (membership.language ?? language ?? 'nb') as LangCode,
        createdAt: (membership.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)) as ISODate,
      },
      { status: 201 },
    );
  } catch (e) {
    if (isAppError(e)) {
      if (e instanceof AppError && e.code === 'not_found') {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }
      const status = e.code === 'conflict' ? 409 : 502;
      return NextResponse.json({ error: e.message }, { status });
    }
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 502 });
  }
}
