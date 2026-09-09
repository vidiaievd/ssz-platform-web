// @vitest-environment node

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));
vi.mock('@/lib/api/profile-directory', () => ({ fetchProfileSummaries: vi.fn() }));
vi.mock('@/features/auth/api/get-current-user', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/features/school/api/get-my-schools', () => ({ getMySchools: vi.fn() }));

const { GET } = await import('./route');
const { GET: GET_JSON } = await import('../decisions/route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { fetchProfileSummaries } from '@/lib/api/profile-directory';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMySchools } from '@/features/school/api/get-my-schools';
import type { ReviewDecisionsResponse } from '@/features/review/types/oversight';

const SCHOOL_ID = '44444444-4444-4444-8444-444444444444';

const decision = (over: Record<string, unknown> = {}) => ({
  attemptId: 'att-1',
  userId: 'student-1',
  exerciseId: 'ex-1',
  exercisePath: { course: 'Ny i Norge A2', module: 'Leksjon 7', exercise: 'Perfektum' },
  reviewerId: 'admin-1',
  verdict: 'returned',
  submittedAt: '2026-08-17T08:00:00.000Z',
  reviewedAt: '2026-08-18T08:00:00.000Z',
  ...over,
});

function upstream(pages: { items: unknown[]; nextCursor: string | null }[]) {
  let call = 0;
  vi.mocked(serverFetch).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/internal/attempts/review/decisions') {
      const page = pages[Math.min(call, pages.length - 1)];
      call += 1;
      return page;
    }
    throw new Error(`unexpected upstream call: ${opts.path}`);
  });
}

const csvRequest = (query = `?school=${SCHOOL_ID}&period=30`) =>
  new NextRequest(`http://localhost/api/review/decisions.csv${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ userId: 'admin-1' } as never);
  vi.mocked(getMySchools).mockResolvedValue([
    { id: SCHOOL_ID, name: 'Skolen', myRole: 'OWNER' },
  ] as never);
  vi.mocked(fetchProfileSummaries).mockResolvedValue({
    'student-1': { userId: 'student-1', displayName: 'Anna Kowalska' },
    'admin-1': { userId: 'admin-1', displayName: 'Ingrid Sæther' },
  } as never);
  upstream([{ items: [decision()], nextCursor: null }]);
});

describe('GET /api/review/decisions', () => {
  it('names both people on the row and says how long the learner waited', async () => {
    const response = await GET_JSON(
      new NextRequest(`http://localhost/api/review/decisions?school=${SCHOOL_ID}&period=30`),
    );
    const body = (await response.json()) as ReviewDecisionsResponse;

    expect(body.items[0]).toMatchObject({
      reviewerName: 'Ingrid Sæther',
      studentName: 'Anna Kowalska',
      exerciseTitle: 'Perfektum',
      verdict: 'returned',
      hours: 24,
    });
  });

  it('refuses a teacher of the school', async () => {
    vi.mocked(getMySchools).mockResolvedValue([
      { id: SCHOOL_ID, name: 'Skolen', myRole: 'TEACHER' },
    ] as never);

    const response = await GET_JSON(
      new NextRequest(`http://localhost/api/review/decisions?school=${SCHOOL_ID}`),
    );
    expect(response.status).toBe(403);
  });
});

describe('GET /api/review/decisions.csv', () => {
  it('serves a UTF-8 CSV Excel will open without mangling the names', async () => {
    const response = await GET(csvRequest());
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    const text = await response.text();

    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toContain('.csv');
    // The byte-order mark, without which Excel reads this in the system code page.
    // Asserted on the bytes: `text()` decodes it away, which is exactly what Excel
    // fails to do.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toContain('"Ingrid Sæther"');
    expect(text).toContain('"sent back"');
  });

  it('names the columns in the language the export was asked for', async () => {
    const response = await GET(csvRequest(`?school=${SCHOOL_ID}&period=30&locale=ru`));
    const text = await response.text();

    expect(text).toContain('"Проверяющий"');
    expect(text).toContain('"возвращено"');
  });

  it('follows the cursor to the end of the period rather than sending one page', async () => {
    upstream([
      { items: [decision({ attemptId: 'a1' })], nextCursor: 'next' },
      { items: [decision({ attemptId: 'a2' })], nextCursor: null },
    ]);

    const text = await (await GET(csvRequest())).text();

    // Header plus two rows, each ended with CRLF.
    expect(text.trimEnd().split('\r\n')).toHaveLength(3);
  });

  it('answers 502 rather than a half-written file when the first page fails', async () => {
    vi.mocked(serverFetch).mockRejectedValue(new Error('down'));

    expect((await GET(csvRequest())).status).toBe(502);
  });
});
