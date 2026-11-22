import { NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { resolveSchoolWorkspace } from '@/features/workspaces/api/resolve-school-workspace';
import type { MembershipStatus, MembershipSource, Membership } from '@/features/enrollment/types';
import type { LangCode, ISODate } from '@/features/groups/types';

type BackendMembership = {
  id: string;
  schoolId: string;
  status: MembershipStatus;
  source: MembershipSource;
  language?: string;
  createdAt: string;
};

type BackendList = { items: BackendMembership[]; nextCursor: string | null };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolSlug: string }> },
) {
  const { schoolSlug } = await params;

  try {
    const school = await resolveSchoolWorkspace(schoolSlug);
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const result = await serverFetch<BackendList>({
      service: 'organization',
      path: `/schools/${school.id}/memberships`,
      query: { status: 'placement-review' },
    });

    const items: Membership[] = result.items.map((m) => ({
      id: m.id,
      schoolId: m.schoolId,
      schoolSlug,
      schoolName: school.name,
      status: m.status,
      source: m.source,
      language: (m.language ?? 'nb') as LangCode,
      createdAt: (m.createdAt?.slice(0, 10) ?? '') as ISODate,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: 'Failed to fetch placement queue' }, { status: 502 });
  }
}
