import type { DiscoveryQuery } from '../schemas';
import type { PageInfo, School } from '../types';

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}

function decodeCursor(cursor: string): number {
  try {
    const n = parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export interface FilteredPage {
  items: School[];
  pageInfo: PageInfo;
}

export function filterSchools(schools: School[], query: DiscoveryQuery): FilteredPage {
  const { q, type, language, level, sort, cursor, limit } = query;

  let results = [...schools];

  if (q) {
    const lq = q.toLowerCase();
    results = results.filter(
      (s) => s.name.toLowerCase().includes(lq) || s.description?.toLowerCase().includes(lq),
    );
  }

  if (type) {
    results = results.filter((s) => s.type === type);
  }

  if (language) {
    results = results.filter((s) => s.targetLanguages.includes(language));
  }

  if (level) {
    results = results.filter((s) => s.levels.includes(level));
  }

  switch (sort) {
    case 'price-asc':
      results.sort((a, b) => (a.priceRangeMin ?? 0) - (b.priceRangeMin ?? 0));
      break;
    case 'students':
      results.sort((a, b) => (b.studentCount ?? 0) - (a.studentCount ?? 0));
      break;
    default:
      results.sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = results.length;
  const offset = cursor ? decodeCursor(cursor) : 0;
  const page = results.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const hasNextPage = nextOffset < total;

  return {
    items: page,
    pageInfo: {
      endCursor: hasNextPage ? encodeCursor(nextOffset) : undefined,
      hasNextPage,
      total,
    },
  };
}
