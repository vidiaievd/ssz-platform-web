import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { School } from '../types';

export async function getSchool(id: string): Promise<School | null> {
  if (!id) return null;
  try {
    return await serverFetch<School>({
      service: 'organization',
      path: `/schools/${id}`,
    });
  } catch {
    return null;
  }
}
