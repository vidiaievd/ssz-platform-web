// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { GET, PUT, DELETE } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const PARAMS = { params: Promise.resolve({ id: 'exercise-1' }) };

const DERIVED = {
  skills: ['reading'],
  focus: ['vocabulary'],
  form: 'bank',
  skillSource: 'template',
  focusSource: 'atoms',
};

function put(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/content/exercises/exercise-1/skills', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function plain(): NextRequest {
  return new NextRequest('http://localhost/api/content/exercises/exercise-1/skills');
}

describe('/api/content/exercises/[id]/skills', () => {
  beforeEach(() => vi.mocked(serverFetch).mockReset());

  it('reads the axes together with where they came from', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(DERIVED);

    const response = await GET(plain(), PARAMS);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DERIVED);
  });

  it('sends both axes on a save, because one marker covers the pair', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce({ ...DERIVED, skillSource: 'override' });

    await PUT(put({ skills: ['listening'], focus: ['grammar'] }), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/exercises/exercise-1/skills',
        method: 'PUT',
        body: { skills: ['listening'], focus: ['grammar'] },
      }),
    );
  });

  it('keeps an empty pair, which is a claim and not an omission', async () => {
    // Two empty lists say "count this exercise towards nothing". Dropping them for a
    // withdrawal would make that claim impossible to express.
    vi.mocked(serverFetch).mockResolvedValueOnce({ ...DERIVED, skills: [], focus: [] });

    await PUT(put({ skills: [], focus: [] }), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PUT', body: { skills: [], focus: [] } }),
    );
  });

  it('drops a value the platform does not know instead of losing the save', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(DERIVED);

    await PUT(put({ skills: ['reading', 'telepathy'], focus: ['grammar'] }), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: { skills: ['reading'], focus: ['grammar'] } }),
    );
  });

  it('orders the lists canonically, so two spellings of one answer cannot exist', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(DERIVED);

    await PUT(put({ skills: ['written', 'listening'], focus: [] }), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(
      expect.objectContaining({ body: { skills: ['listening', 'written'], focus: [] } }),
    );
  });

  it('refuses a request with no body rather than saving an empty pair', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/content/exercises/exercise-1/skills', {
        method: 'PUT',
        body: 'not json',
      }),
      PARAMS,
    );

    expect(response.status).toBe(400);
    expect(serverFetch).not.toHaveBeenCalled();
  });

  it('answers a withdrawal with the derived axes, not with nothing', async () => {
    vi.mocked(serverFetch).mockResolvedValueOnce(DERIVED);

    const response = await DELETE(plain(), PARAMS);

    expect(serverFetch).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE' }));
    expect(await response.json()).toEqual(DERIVED);
  });

  it('passes a refusal through as a refusal, not as a broken gateway', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(new AppError('forbidden', 'nope', 403));

    const response = await PUT(put({ skills: [], focus: [] }), PARAMS);

    expect(response.status).toBe(403);
  });
});
