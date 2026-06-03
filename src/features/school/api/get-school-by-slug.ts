import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { School } from '../types';

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  if (!slug) return null;
  try {
    return await serverFetch<School>({
      service: 'organization',
      path: `/schools/by-slug/${slug}`,
    });
  } catch {
    return null;
  }
}
