import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod/v4';

// Mocks — must be declared before the dynamic import.
const mockReplace = vi.fn();
const mockGet = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
    entries: function* () {
      for (const [k, v] of Object.entries(capturedParams)) {
        yield [k, v];
      }
    },
  }),
}));

vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/test',
}));

let capturedParams: Record<string, string> = {};

const { useUrlFilters } = await import('./use-url-filters');

const schema = z.object({
  search: z.string().optional(),
  level: z.enum(['A1', 'A2', 'B1']).optional(),
});

describe('useUrlFilters', () => {
  beforeEach(() => {
    capturedParams = {};
    mockReplace.mockClear();
    mockGet.mockClear();
  });

  it('returns parsed filters from empty search params', () => {
    const { result } = renderHook(() => useUrlFilters(schema));
    const [filters] = result.current;
    expect(filters.search).toBeUndefined();
    expect(filters.level).toBeUndefined();
  });

  it('returns parsed filters from populated search params', () => {
    capturedParams = { search: 'hello', level: 'A1' };
    const { result } = renderHook(() => useUrlFilters(schema));
    const [filters] = result.current;
    expect(filters.search).toBe('hello');
    expect(filters.level).toBe('A1');
  });

  it('updates local state immediately on setFilters call', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useUrlFilters(schema));
    act(() => {
      result.current[1]({ search: 'norsk' });
    });
    expect(result.current[0].search).toBe('norsk');
    vi.useRealTimers();
  });

  it('debounces router.replace by 300 ms', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useUrlFilters(schema));
    act(() => {
      result.current[1]({ search: 'norsk' });
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(mockReplace).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('omits undefined/empty values from the URL', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useUrlFilters(schema));
    act(() => {
      result.current[1]({ search: undefined });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const calledUrl = mockReplace.mock.calls[0]?.[0] as string | undefined;
    expect(calledUrl ?? '').not.toContain('search=');
    vi.useRealTimers();
  });
});
