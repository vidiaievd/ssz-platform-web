'use client';

import { useState } from 'react';

import { RequestDialog } from '@/features/enrollment/components/request-dialog';
import { useUrlFilters } from '@/lib/url-filters/use-url-filters';
import { discoverFilterSchema } from '../schemas';
import type { DiscoverFilter } from '../schemas';
import type { School, SchoolsResponse } from '../types';
import { DiscoverFilters } from './discover-filters';
import { SchoolsGrid } from './schools-grid';

interface DiscoverSurfaceProps {
  initialData?: SchoolsResponse;
  initialQuery?: DiscoverFilter;
}

export function DiscoverSurface({ initialData }: DiscoverSurfaceProps) {
  const [filters] = useUrlFilters(discoverFilterSchema);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  return (
    <>
      <div className="space-y-6">
        <DiscoverFilters />
        <SchoolsGrid filters={filters} initialData={initialData} onEnrol={setSelectedSchool} />
      </div>

      <RequestDialog
        school={selectedSchool}
        open={selectedSchool !== null}
        onClose={() => setSelectedSchool(null)}
      />
    </>
  );
}
