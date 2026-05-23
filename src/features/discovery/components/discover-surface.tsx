'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { schoolFiltersSchema } from '../schemas';
import type { School } from '../types';
import { DiscoverFilters } from './discover-filters';
import { SchoolsGrid } from './schools-grid';

export function DiscoverSurface() {
  const t = useTranslations('Discovery');
  const [filters] = useUrlFilters(schoolFiltersSchema);

  const handleEnrol = useCallback(
    (school: School) => {
      // Enrollment request dialog wired in Step 10.3.
      toast.info(t('enrollComingSoon', { name: school.name }));
    },
    [t],
  );

  return (
    <div className="space-y-6">
      <DiscoverFilters />
      <SchoolsGrid filters={filters} onEnrol={handleEnrol} />
    </div>
  );
}
