import 'server-only';

import { filterSchools } from './filter-schools';
import type { DiscoveryQuery } from '../schemas';
import type { School, SchoolsResponse } from '../types';
import { serverFetch } from '@/lib/api/server-fetcher';

export type BackendPublicSchool = {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  description?: string;
  avatarUrl?: string;
  city?: string;
  website?: string;
  isOpenForApplications: boolean;
};

export function backendSchoolToFrontend(s: BackendPublicSchool): School {
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

export async function getSchools(query: DiscoveryQuery): Promise<SchoolsResponse> {
  const raw = await serverFetch<BackendPublicSchool[]>({
    service: 'organization',
    path: '/schools/public',
    anonymous: true,
  });
  return filterSchools(raw.map(backendSchoolToFrontend), query);
}
