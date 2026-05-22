'use client';

import { CatalogueFilters } from '@/features/content/components/catalogue-filters';
import { ContainerGrid } from '@/features/content/components/container-grid';

export function CatalogueClientView() {
  return (
    <div className="space-y-6">
      <CatalogueFilters />
      <ContainerGrid
        scope="public"
        buildHref={(slug) => `/catalogue/${slug}`}
      />
    </div>
  );
}
