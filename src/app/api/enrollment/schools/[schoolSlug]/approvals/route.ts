import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import type { PublicSchool } from '@/features/school/api/get-public-school';
import type { MembershipStatus, MembershipSource, Membership } from '@/features/enrollment/types';
import type { CEFR, LangCode, ISODate } from '@/features/groups/types';

type BackendMembership = {
  id: string;
  schoolId: string;
  status: MembershipStatus;
  source: MembershipSource;
  language?: string;
  selfReportedLevel?: CEFR;
  createdAt: string;
};

type BackendList = { items: BackendMembership[]; nextCursor: string | null };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolSlug: string }> },
) {
  const { schoolSlug } = await params;

  try {
    const school = await serverFetch<PublicSchool>({
      service: 'organization',
      path: `/schools/public/${schoolSlug}`,
      anonymous: true,
    });

    const result = await serverFetch<BackendList>({
      service: 'organization',
      path: `/schools/${school.schoolId}/memberships`,
      query: { status: 'pending' },
    });

    const items: Membership[] = result.items.map((m) => ({
      id: m.id,
      schoolId: m.schoolId,
      schoolSlug,
      schoolName: school.schoolName,
      status: m.status,
      source: m.source,
      language: (m.language ?? 'nb') as LangCode,
      selfReportedLevel: m.selfReportedLevel,
      createdAt: (m.createdAt?.slice(0, 10) ?? '') as ISODate,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: 'Failed to fetch pending approvals' }, { status: 502 });
  }
}
