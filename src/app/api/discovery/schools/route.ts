import { NextRequest, NextResponse } from 'next/server';

import {
  backendSchoolToFrontend,
  type BackendPublicSchool,
} from '@/features/discovery/api/get-schools.server';
import { filterSchools } from '@/features/discovery/api/filter-schools';
import { discoveryQuerySchema } from '@/features/discovery/schemas';
import { serverFetch } from '@/lib/api/server-fetcher';

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

  const schools = raw.map(backendSchoolToFrontend);
  return NextResponse.json(filterSchools(schools, parsed.data));
}
