// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers(),
}));

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

const { updateProfileAction } = await import('./update-profile');
const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockServerFetch = vi.mocked(serverFetch);

const VALID_INPUT = {
  displayName: 'Jane Doe',
  bio: 'I teach Norwegian.',
  uiLocale: 'en' as const,
  instructionLocales: ['nb' as const],
  timezone: 'Europe/Oslo',
  contactEmail: null,
  contactPhone: null,
};

const PROFILE_RESPONSE = {
  id: '1',
  userId: 'u1',
  handle: null,
  displayName: 'Jane Doe',
  bio: 'I teach Norwegian.',
  avatarUrl: null,
  uiLocale: 'en',
  instructionLocales: ['nb'],
  timezone: 'Europe/Oslo',
  contactEmail: null,
  contactPhone: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('updateProfileAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns updated profile on success', async () => {
    mockServerFetch.mockResolvedValue(PROFILE_RESPONSE);

    const result = await updateProfileAction(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe('Jane Doe');
    expect(mockServerFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'profile',
        path: '/profiles/me',
        method: 'PATCH',
      }),
    );
  });

  it('returns validation error for invalid input (no HTTP call)', async () => {
    const result = await updateProfileAction({ ...VALID_INPUT, displayName: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(mockServerFetch).not.toHaveBeenCalled();
  });

  it('propagates upstream_unavailable from service', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('upstream_unavailable', 'Service down'));

    const result = await updateProfileAction(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('upstream_unavailable');
  });

  it('propagates validation error from service (e.g. 422)', async () => {
    const { AppError } = await import('@/lib/errors');
    mockServerFetch.mockRejectedValue(new AppError('validation', 'Server validation failed'));

    const result = await updateProfileAction(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
  });
});
