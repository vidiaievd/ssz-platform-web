import { describe, expect, it } from 'vitest';

import type { School } from '../types';
import { filterSchools } from './filter-schools';

const BASE_QUERY = { limit: 12 } as const;

function makeSchool(overrides: Partial<School> & Pick<School, 'id' | 'name'>): School {
  return {
    slug: overrides.id,
    type: 'school',
    targetLanguages: [],
    levels: [],
    containerCount: 0,
    isFree: false,
    ...overrides,
  };
}

const SCHOOLS: School[] = [
  makeSchool({ id: '1', name: 'Oslo Language School', description: 'Norwegian lessons', location: 'Oslo' }),
  makeSchool({ id: '2', name: 'Berlin Academy', description: 'German courses' }),
  makeSchool({ id: '3', name: 'Kyiv Language Center', description: 'Ukrainian and English' }),
  makeSchool({ id: '4', name: 'Alpha Tutors', type: 'tutor' }),
];

describe('filterSchools', () => {
  it('returns all items when no filters applied', () => {
    const { items, pageInfo } = filterSchools(SCHOOLS, BASE_QUERY);
    expect(items).toHaveLength(4);
    expect(pageInfo.total).toBe(4);
    expect(pageInfo.hasNextPage).toBe(false);
    expect(pageInfo.endCursor).toBeUndefined();
  });

  it('filters by search query in name', () => {
    const { items, pageInfo } = filterSchools(SCHOOLS, { ...BASE_QUERY, q: 'oslo' });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('1');
    expect(pageInfo.total).toBe(1);
  });

  it('filters by search query in description', () => {
    const { items } = filterSchools(SCHOOLS, { ...BASE_QUERY, q: 'german' });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('2');
  });

  it('returns empty items for no-match search', () => {
    const { items, pageInfo } = filterSchools(SCHOOLS, { ...BASE_QUERY, q: 'tokyo' });
    expect(items).toHaveLength(0);
    expect(pageInfo.total).toBe(0);
    expect(pageInfo.hasNextPage).toBe(false);
  });

  it('filters by type=tutor', () => {
    const { items } = filterSchools(SCHOOLS, { ...BASE_QUERY, type: 'tutor' });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('4');
  });

  it('filters by type=school', () => {
    const { items } = filterSchools(SCHOOLS, { ...BASE_QUERY, type: 'school' });
    expect(items).toHaveLength(3);
    expect(items.every((s) => s.type === 'school')).toBe(true);
  });

  it('paginates with limit', () => {
    const { items, pageInfo } = filterSchools(SCHOOLS, { limit: 2 });
    expect(items).toHaveLength(2);
    expect(pageInfo.total).toBe(4);
    expect(pageInfo.hasNextPage).toBe(true);
    expect(pageInfo.endCursor).toBeDefined();
  });

  it('returns next page using endCursor', () => {
    const first = filterSchools(SCHOOLS, { limit: 2 });
    const second = filterSchools(SCHOOLS, { limit: 2, cursor: first.pageInfo.endCursor });
    expect(second.items).toHaveLength(2);
    expect(second.pageInfo.hasNextPage).toBe(false);
    expect(second.pageInfo.endCursor).toBeUndefined();
    const firstIds = first.items.map((s) => s.id);
    const secondIds = second.items.map((s) => s.id);
    expect(firstIds).not.toEqual(secondIds);
    expect([...firstIds, ...secondIds].sort()).toEqual(['1', '2', '3', '4'].sort());
  });

  it('last page has hasNextPage=false even when total is divisible by limit', () => {
    const schools = [makeSchool({ id: 'a', name: 'A' }), makeSchool({ id: 'b', name: 'B' })];
    const { pageInfo } = filterSchools(schools, { limit: 2 });
    expect(pageInfo.hasNextPage).toBe(false);
  });

  it('sorts by name (default)', () => {
    const { items } = filterSchools(SCHOOLS, { ...BASE_QUERY, sort: 'name' });
    const names = items.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts by price-asc', () => {
    const priced = [
      makeSchool({ id: 'x', name: 'X', priceRangeMin: 50 }),
      makeSchool({ id: 'y', name: 'Y', priceRangeMin: 10 }),
      makeSchool({ id: 'z', name: 'Z', priceRangeMin: 30 }),
    ];
    const { items } = filterSchools(priced, { limit: 10, sort: 'price-asc' });
    expect(items.map((s) => s.id)).toEqual(['y', 'z', 'x']);
  });
});
