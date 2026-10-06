// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server-fetcher', () => ({ serverFetch: vi.fn() }));

const { POST } = await import('./route');
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

const request = () =>
  new NextRequest('http://localhost/api/media/uploads/a1/finalize', { method: 'POST' });
const params = Promise.resolve({ assetId: 'a1' });

beforeEach(() => vi.mocked(serverFetch).mockReset());

describe('POST /api/media/uploads/[assetId]/finalize', () => {
  it('answers 204 when the upload is accepted', async () => {
    vi.mocked(serverFetch).mockResolvedValue(undefined);
    const res = await POST(request(), { params });
    expect(res.status).toBe(204);
  });

  it('passes a refused recording on as 422 with its code (plan 70 §3.4)', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('validation', 'Upstream 422', {
        message: 'RECORDING_TOO_LONG',
        statusCode: 422,
      }),
    );
    const res = await POST(request(), { params });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      error: 'Upload refused',
      code: 'RECORDING_TOO_LONG',
    });
  });

  it('does not mistake prose for a code', async () => {
    vi.mocked(serverFetch).mockRejectedValueOnce(
      new AppError('validation', 'Upstream 422', {
        message: 'File was not found in storage. Please upload before finalizing.',
      }),
    );
    const res = await POST(request(), { params });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: 'Upload refused' });
  });
});
