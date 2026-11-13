import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';

import type { SeatUsage } from '../types';

/**
 * The school's seat standing, or null when it cannot be had (not a manager of this school,
 * organization-service down). A missing number must never break the screen it decorates.
 */
export async function getSchoolSeats(schoolId: string): Promise<SeatUsage | null> {
  try {
    return await serverFetch<SeatUsage>({
      service: 'organization',
      path: `/schools/${schoolId}/seats`,
      expectedErrorStatuses: [403, 404],
    });
  } catch {
    return null;
  }
}
