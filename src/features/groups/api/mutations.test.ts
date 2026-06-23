// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

vi.mock('@/features/school/api/resolve-school-id', () => ({
  resolveSchoolId: vi.fn().mockResolvedValue('school-uuid-1'),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockFetch = vi.mocked(serverFetch);

const { createGroup, updateGroup, addGroupMaterial, removeGroupMaterial } = await import('./mutations');

describe('createGroup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends capacityMin/capacityMax (not minCapacity/maxCapacity) to organization-service', async () => {
    mockFetch.mockResolvedValue({ id: 'g1' });

    await createGroup('school-1', {
      name: 'Norwegian A2',
      lang: 'nb',
      level: 'A2',
      mode: 'online',
      capacityMin: 4,
      capacityMax: 15,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ capacityMin: 4, capacityMax: 15 }),
      }),
    );
  });

  it('converts the frontend\'s "in-person" mode to the backend\'s "in_person"', async () => {
    mockFetch.mockResolvedValue({ id: 'g1' });

    await createGroup('school-1', {
      name: 'Norwegian A2',
      lang: 'nb',
      level: 'A2',
      mode: 'in-person',
      capacityMin: 4,
      capacityMax: 15,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ mode: 'in_person' }) }),
    );
  });
});

describe('updateGroup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends capacityMin/capacityMax (not minCapacity/maxCapacity) to organization-service', async () => {
    mockFetch.mockResolvedValue(undefined);

    await updateGroup('school-1', 'g1', { capacityMin: 1, capacityMax: 20 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ capacityMin: 1, capacityMax: 20 }),
      }),
    );
  });

  it('converts mode when provided, and omits it when not', async () => {
    mockFetch.mockResolvedValue(undefined);

    await updateGroup('school-1', 'g1', { mode: 'in-person' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ mode: 'in_person' }) }),
    );

    mockFetch.mockClear();
    await updateGroup('school-1', 'g1', { name: 'New name' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.not.objectContaining({ mode: expect.anything() }) }),
    );
  });
});

describe('addGroupMaterial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts to the group materials endpoint with the courseId', async () => {
    mockFetch.mockResolvedValue({ id: 'mat-1' });

    const result = await addGroupMaterial('school-1', 'g1', 'course-1');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/schools/school-uuid-1/groups/g1/materials',
        method: 'POST',
        body: { courseId: 'course-1' },
      }),
    );
    expect(result).toEqual({ ok: true, id: 'mat-1' });
  });
});

describe('removeGroupMaterial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the group material by id', async () => {
    mockFetch.mockResolvedValue(undefined);

    const result = await removeGroupMaterial('school-1', 'g1', 'mat-1');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/schools/school-uuid-1/groups/g1/materials/mat-1',
        method: 'DELETE',
      }),
    );
    expect(result).toEqual({ ok: true });
  });
});
