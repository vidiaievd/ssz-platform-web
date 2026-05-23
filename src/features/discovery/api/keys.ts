import { keyFactory } from '@/lib/query/keys';

import type { SchoolFilters } from '../schemas';

export const discoveryKeys = keyFactory('discovery', {
  schools: (filters?: SchoolFilters) => ['schools', filters ?? {}] as const,
  school: (id: string) => ['school', id] as const,
});
