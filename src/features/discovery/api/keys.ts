import { keyFactory } from '@/lib/query/keys';

import type { DiscoverFilter } from '../schemas';

export const discoveryKeys = keyFactory('discovery', {
  schools: (filters?: DiscoverFilter) => ['schools', filters ?? {}] as const,
  school: (id: string) => ['school', id] as const,
});
