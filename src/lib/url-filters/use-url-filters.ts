'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { z } from 'zod/v4';

import { useRouter, usePathname } from '@/lib/i18n/navigation';

function parseSearchParams<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams,
): z.output<T> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    raw[key] = value;
  }
  const result = schema.safeParse(raw);
  return result.success ? result.data : (schema.parse({}) as z.output<T>);
}

function filtersToSearchParams(filters: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  return params;
}

/**
 * Returns [filters, setFilters] backed by URL search params.
 * Optimistic updates are reflected immediately; the URL write is debounced by
 * 300 ms. Back/forward navigation re-derives from `searchParams` automatically.
 */
export function useUrlFilters<T extends z.ZodType>(
  schema: T,
): [z.output<T>, (patch: Partial<z.output<T>>) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimistic pending patch on top of the URL-derived state.
  const [pending, setPending] = useState<Partial<Record<string, unknown>>>({});

  const urlFilters = useMemo(
    () => parseSearchParams(schema, searchParams),
    [schema, searchParams],
  );

  const filters = useMemo(
    () => ({ ...(urlFilters as Record<string, unknown>), ...pending }) as z.output<T>,
    [urlFilters, pending],
  );

  const setFilters = useCallback(
    (patch: Partial<z.output<T>>) => {
      setPending((prev) => {
        const nextPending = { ...prev, ...(patch as Record<string, unknown>) };

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const next = { ...(urlFilters as Record<string, unknown>), ...nextPending };
          setPending({});
          const params = filtersToSearchParams(next);
          router.replace(`${pathname}?${params.toString()}` as never, { scroll: false });
        }, 300);

        return nextPending;
      });
    },
    [router, pathname, urlFilters],
  );

  return [filters, setFilters];
}
