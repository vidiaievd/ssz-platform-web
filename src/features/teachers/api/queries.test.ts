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

describe('getTeacherRoster', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps a member row to TeacherRosterRow', async () => {
    mockFetch.mockResolvedValue([MEMBER_ROW]);

    const roster = await getTeacherRoster('school-1');

    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      userId: 'u1',
      name: 'Anna Berg',
      email: 'anna@example.com',
      avatarUrl: 'https://cdn/anna.jpg',
      languages: ['nb', 'en'],
      role: 'TEACHER',
      status: 'active',
      maxWeeklyHours: 18,
      joinedAt: '2026-06-01T00:00:00Z',
    });
  });

  it('defaults missing fields gracefully', async () => {
    mockFetch.mockResolvedValue([{ userId: 'u2' }]);

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
    mockFetch.mockResolvedValue([{ ...MEMBER_ROW, status: 'pending' }]);
    const roster = await getTeacherRoster('school-1');
    expect(roster[0]?.status).toBe('pending');
  });

  it('returns empty array when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const roster = await getTeacherRoster('school-1');
    expect(roster).toEqual([]);
  });

  it('filters out non-TEACHER members', async () => {
    mockFetch.mockResolvedValue([
      { ...MEMBER_ROW, role: 'STUDENT' },
      MEMBER_ROW,
    ]);
    const roster = await getTeacherRoster('school-1');
    expect(roster).toHaveLength(1);
  });

  it('calls members endpoint with role=TEACHER filter', async () => {
    mockFetch.mockResolvedValue([MEMBER_ROW]);

    await getTeacherRoster('school-42');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'organization',
        path: '/schools/school-42/members',
        query: { role: 'TEACHER' },
      }),
    );
  });
});
