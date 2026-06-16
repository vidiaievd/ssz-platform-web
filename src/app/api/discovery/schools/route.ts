import { NextRequest, NextResponse } from 'next/server';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { School, SchoolsResponse } from '@/features/discovery/types';

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
  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search')?.toLowerCase();
  const type = searchParams.get('type');

  let schools: BackendPublicSchool[];
  try {
    schools = await serverFetch<BackendPublicSchool[]>({
      service: 'organization',
      path: '/schools/public',
      anonymous: true,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 502 });
  }

  let results = schools.map(toFrontend);

  if (search) {
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.description?.toLowerCase().includes(search),
    );
  }
  if (type) {
    results = results.filter((s) => s.type === type);
  }

  const response: SchoolsResponse = {
    items: results,
    pageInfo: { hasNextPage: false, total: results.length },
  };
  return NextResponse.json(response);
}
