import { NextRequest, NextResponse } from 'next/server';

import { filterSchools } from '@/features/discovery/api/filter-schools';
import { discoveryQuerySchema } from '@/features/discovery/schemas';
import type { School } from '@/features/discovery/types';
import { serverFetch } from '@/lib/api/server-fetcher';

type BackendPublicSchool = {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  description?: string;
  avatarUrl?: string;
  city?: string;
  website?: string;
  isOpenForApplications: boolean;
};

function toFrontend(s: BackendPublicSchool): School {
  return {
    id: s.schoolId,
    name: s.schoolName,
    slug: s.schoolSlug,
    type: 'school',
    description: s.description,
    coverImageUrl: s.avatarUrl,
    location: s.city,
    targetLanguages: [],
    levels: [],
    containerCount: 0,
    isFree: false,
  };
}

export async function GET(request: NextRequest) {
  const parsed = discoveryQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  let raw: BackendPublicSchool[];
  try {
    raw = await serverFetch<BackendPublicSchool[]>({
      service: 'organization',
      path: '/schools/public',
      anonymous: true,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 502 });
  }

  const schools = raw.map(toFrontend);
  return NextResponse.json(filterSchools(schools, parsed.data));
}
