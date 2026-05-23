'use client';

import { useState } from 'react';

import { RequestDialog } from '@/features/enrollment/components/request-dialog';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { schoolFiltersSchema } from '../schemas';
import type { School } from '../types';
import { DiscoverFilters } from './discover-filters';
import { SchoolsGrid } from './schools-grid';

export function DiscoverSurface() {
  const [filters] = useUrlFilters(schoolFiltersSchema);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  return (
    <>
      <div className="space-y-6">
        <DiscoverFilters />
        <SchoolsGrid filters={filters} onEnrol={setSelectedSchool} />
      </div>

      <RequestDialog
        school={selectedSchool}
        open={selectedSchool !== null}
        onClose={() => setSelectedSchool(null)}
      />
    </>
  );
}
