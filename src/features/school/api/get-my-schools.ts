import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { readAccessToken } from '@/lib/auth/cookies';
import type { School } from '../types';

type SchoolsPayload =
  | School[]
  | { items: School[] }
  | { schools: School[] }
  | { data: School[] };

function normalise(payload: SchoolsPayload): School[] {
  if (Array.isArray(payload)) return payload;
  if ('items' in payload && Array.isArray(payload.items)) return payload.items;
  if ('schools' in payload && Array.isArray(payload.schools)) return payload.schools;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function getMySchools(): Promise<School[]> {
  const token = await readAccessToken();
  if (!token) return [];

  try {
    const payload = await serverFetch<SchoolsPayload>({
      service: 'organization',
      path: '/schools',
    });
    return normalise(payload);
  } catch {
    return [];
  }
}
