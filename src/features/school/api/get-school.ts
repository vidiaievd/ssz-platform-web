import 'server-only';

import { cache } from 'react';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { School } from '../types';

/** Cached per request: the workspace layout, its lifecycle and its pages read the same school. */
export const getSchool = cache(async function (id: string): Promise<School | null> {
  if (!id) return null;
  try {
    return await serverFetch<School>({
      service: 'organization',
      path: `/schools/${id}`,
    });
  } catch {
    return null;
  }
});
