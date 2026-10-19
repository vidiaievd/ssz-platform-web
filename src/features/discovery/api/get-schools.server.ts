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

type BackendPublicSchoolsPage = {
  items: BackendPublicSchool[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean; total: number };
};

const PAGE_SIZE = 100;
// A guard against a cursor that never ends, not a real ceiling: 50 pages is 5 000 schools.
const MAX_PAGES = 50;

/**
 * Every school with a public page, unfiltered — discovery and the sitemap both start here.
 * organization-service pages the list by cursor; filtering and paging for the visitor happen
 * here in the web app (`filterSchools`), so all pages are read.
 */
export async function listPublicSchools(): Promise<BackendPublicSchool[]> {
  const schools: BackendPublicSchool[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set('cursor', cursor);
    const res: BackendPublicSchoolsPage = await serverFetch<BackendPublicSchoolsPage>({
      service: 'organization',
      path: `/schools/public?${params.toString()}`,
      anonymous: true,
    });
    schools.push(...res.items);
    if (!res.pageInfo.hasNextPage || !res.pageInfo.endCursor) break;
    cursor = res.pageInfo.endCursor;
  }
  return schools;
}

export async function getSchools(query: DiscoveryQuery): Promise<SchoolsResponse> {
  const raw = await listPublicSchools();
  return filterSchools(raw.map(backendSchoolToFrontend), query);
}
