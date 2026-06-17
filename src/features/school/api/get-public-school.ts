import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';

export interface PublicSchool {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  description?: string;
  avatarUrl?: string;
  city?: string;
  website?: string;
  isOpenForApplications: boolean;
}

export async function getPublicSchool(slug: string): Promise<PublicSchool | null> {
  if (!slug) return null;
  try {
    return await serverFetch<PublicSchool>({
      service: 'organization',
      path: `/schools/public/${slug}`,
      anonymous: true,
    });
  } catch {
    return null;
  }
}
