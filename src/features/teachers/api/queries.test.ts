// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({
  serverFetch: vi.fn(),
}));

// queries.ts uses 'server-only' — stub it
vi.mock('server-only', () => ({}));

const { serverFetch } = await import('@/lib/api/server-fetcher');
const mockFetch = vi.mocked(serverFetch);

// Import after mocks are in place; React.cache is a passthrough in tests
const { getTeacherRoster } = await import('./queries');

const MEMBER_ROW = {
  userId: 'u1',
  name: 'Anna Berg',
  email: 'anna@example.com',
  avatarUrl: 'https://cdn/anna.jpg',
  role: 'TEACHER',
  langs: ['nb', 'en'],
  maxWeeklyHours: 18,
  status: 'active',
  joinedAt: '2026-06-01T00:00:00Z',
};

const PROFILE_ROW = {
  userId: 'u1',
  displayName: 'Anna Berg (Profile)',
  avatarUrl: 'https://cdn/anna-profile.jpg',
};

function mockOrgThenProfile(
  members: unknown[],
  profiles: unknown[],
) {
  mockFetch.mockImplementation((opts: { service: string }) => {
    if (opts.service === 'organization') return Promise.resolve(members);
    if (opts.service === 'profile') return Promise.resolve(profiles);
    return Promise.resolve([]);
  });
}

describe('getTeacherRoster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses profile displayName and avatarUrl over org member data', async () => {
    mockOrgThenProfile([MEMBER_ROW], [PROFILE_ROW]);

    const roster = await getTeacherRoster('school-1');

    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      userId: 'u1',
      name: 'Anna Berg (Profile)',
      avatarUrl: 'https://cdn/anna-profile.jpg',
      email: 'anna@example.com',
      languages: ['nb', 'en'],
      role: 'TEACHER',
      status: 'active',
      maxWeeklyHours: 18,
      joinedAt: '2026-06-01T00:00:00Z',
    });
  });

  it('falls back to org name when profile not found', async () => {
    mockOrgThenProfile([MEMBER_ROW], []);

    const roster = await getTeacherRoster('school-1');

    expect(roster[0]).toMatchObject({
      name: 'Anna Berg',
      avatarUrl: 'https://cdn/anna.jpg',
    });
  });

  it('falls back to org data when profile-service throws', async () => {
    mockFetch.mockImplementation((opts: { service: string }) => {
      if (opts.service === 'organization') return Promise.resolve([MEMBER_ROW]);
      return Promise.reject(new Error('profile-service down'));
    });

    const roster = await getTeacherRoster('school-1');

    expect(roster[0]).toMatchObject({
      name: 'Anna Berg',
      avatarUrl: 'https://cdn/anna.jpg',
    });
  });

  it('defaults missing fields gracefully', async () => {
    mockOrgThenProfile([{ userId: 'u2' }], []);

    const roster = await getTeacherRoster('school-1');

    expect(roster[0]).toMatchObject({
      userId: 'u2',
      name: '',
      email: '',
      avatarUrl: null,
      languages: [],
      role: 'TEACHER',
      status: 'active',
      maxWeeklyHours: 20,
      joinedAt: '',
    });
  });

  it('maps status: pending correctly', async () => {
    mockOrgThenProfile([{ ...MEMBER_ROW, status: 'pending' }], [PROFILE_ROW]);
    const roster = await getTeacherRoster('school-1');
    expect(roster[0]?.status).toBe('pending');
  });

  it('returns empty array when org fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const roster = await getTeacherRoster('school-1');
    expect(roster).toEqual([]);
  });

  it('returns empty array when no members', async () => {
    mockOrgThenProfile([], []);
    const roster = await getTeacherRoster('school-1');
    expect(roster).toEqual([]);
  });

  it('filters out non-TEACHER members', async () => {
    mockOrgThenProfile(
      [{ ...MEMBER_ROW, role: 'STUDENT' }, MEMBER_ROW],
      [PROFILE_ROW],
    );
    const roster = await getTeacherRoster('school-1');
    expect(roster).toHaveLength(1);
  });

  it('calls members endpoint then profile batch with correct userIds', async () => {
    mockOrgThenProfile([MEMBER_ROW], [PROFILE_ROW]);

    await getTeacherRoster('school-42');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'organization',
        path: '/schools/school-42/members',
        query: { role: 'TEACHER' },
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'profile',
        path: '/profiles',
        query: { userIds: 'u1' },
      }),
    );
  });

  it('batches multiple teacher userIds in single profile request', async () => {
    const member2 = { ...MEMBER_ROW, userId: 'u2', email: 'b@b.com' };
    mockOrgThenProfile([MEMBER_ROW, member2], [
      PROFILE_ROW,
      { userId: 'u2', displayName: 'Bob' },
    ]);

    const roster = await getTeacherRoster('school-1');

    expect(roster).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'profile',
        query: { userIds: 'u1,u2' },
      }),
    );
    expect(roster[1]?.name).toBe('Bob');
  });
});
