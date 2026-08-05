// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadAsset, uploadToPresignedUrl } from './upload';

// ── XHR stub ──────────────────────────────────────────────────────────────────
// Must be a real class so `new XMLHttpRequest()` works.

type XHRListener = () => void;
type ProgressListener = (e: { lengthComputable: boolean; loaded: number; total: number }) => void;

class FakeXHR {
  // Static capture — lets tests reach the instance created inside the module.
  static last: FakeXHR;

  status = 200;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  upload = { addEventListener: vi.fn() };

  private listeners: Record<string, XHRListener[]> = {};

  constructor() {
    FakeXHR.last = this;
  }

  addEventListener(event: string, handler: XHRListener) {
    (this.listeners[event] ??= []).push(handler);
  }

  _triggerLoad() {
    (this.listeners['load'] ?? []).forEach((h) => h());
  }

  _triggerError() {
    (this.listeners['error'] ?? []).forEach((h) => h());
  }

  _triggerUploadProgress(loaded: number, total: number) {
    const calls = this.upload.addEventListener.mock.calls as [string, ProgressListener][];
    calls
      .filter(([evt]) => evt === 'progress')
      .forEach(([, handler]) => handler({ lengthComputable: true, loaded, total }));
  }
}

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── uploadToPresignedUrl ──────────────────────────────────────────────────────

describe('uploadToPresignedUrl', () => {
  it('resolves when the XHR load event fires with a 2xx status', async () => {
    const file = new File(['hello'], 'avatar.jpg', { type: 'image/jpeg' });

    const promise = uploadToPresignedUrl('https://minio.example/presigned', file);
    const xhr = FakeXHR.last;

    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://minio.example/presigned');
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(xhr.send).toHaveBeenCalledWith(file);

    xhr.status = 200;
    xhr._triggerLoad();
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects when the XHR load event fires with a non-2xx status', async () => {
    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });

    const promise = uploadToPresignedUrl('https://minio.example/presigned', file);
    const xhr = FakeXHR.last;
    xhr.status = 403;
    xhr._triggerLoad();

    await expect(promise).rejects.toThrow('403');
  });

  it('rejects when the XHR error event fires', async () => {
    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });

    const promise = uploadToPresignedUrl('https://minio.example/presigned', file);
    FakeXHR.last._triggerError();

    await expect(promise).rejects.toThrow(/network error/i);
  });

  it('calls onProgress with percentage when upload progress events fire', async () => {
    const onProgress = vi.fn();
    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });

    const promise = uploadToPresignedUrl('https://minio.example/presigned', file, onProgress);
    const xhr = FakeXHR.last;
    xhr._triggerUploadProgress(50, 100);
    xhr._triggerUploadProgress(100, 100);
    xhr.status = 200;
    xhr._triggerLoad();
    await promise;

    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100);
  });
});

// ── uploadAsset (full two-step flow) ─────────────────────────────────────────

const ASSET_ID = 'asset-abc';
const UPLOAD_URL = 'https://minio.example/presigned-put';
const ASSET_URL = 'https://cdn.example/avatar.jpg';

function mockFetch(sequence: Array<{ ok: boolean; status?: number; body?: object }>) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const resp = sequence[call++] ?? { ok: false, status: 500 };
      return {
        ok: resp.ok,
        status: resp.status ?? (resp.ok ? 200 : 500),
        json: async () => resp.body ?? {},
      };
    }),
  );
}

/** Let all queued microtasks drain before the next macrotask. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('uploadAsset', () => {
  it('completes the full flow and returns the finalized asset', async () => {
    mockFetch([
      { ok: true, status: 201, body: { assetId: ASSET_ID, uploadUrl: UPLOAD_URL } },
      { ok: true, status: 204 },
      {
        ok: true,
        status: 200,
        body: {
          id: ASSET_ID,
          url: ASSET_URL,
          mimeType: 'image/jpeg',
          sizeBytes: 5,
          originalFilename: 'x.jpg',
          createdAt: '2026-01-01T00:00:00Z',
        },
      },
    ]);

    const file = new File(['hello'], 'avatar.jpg', { type: 'image/jpeg' });
    const promise = uploadAsset({ file, purpose: 'avatar' });

    // The XHR is created inside uploadToPresignedUrl, which runs after the
    // first await-fetch resolves. Drain the microtask queue first.
    await tick();

    const xhr = FakeXHR.last;
    xhr.status = 200;
    xhr._triggerLoad();

    const result = await promise;
    expect(result.asset.url).toBe(ASSET_URL);
    expect(result.asset.id).toBe(ASSET_ID);
  });

  it('throws when the request-upload BFF call fails', async () => {
    mockFetch([{ ok: false, status: 502 }]);

    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    await expect(uploadAsset({ file })).rejects.toThrow('502');
  });

  it('throws when the MinIO PUT fails', async () => {
    mockFetch([
      { ok: true, status: 201, body: { assetId: ASSET_ID, uploadUrl: UPLOAD_URL } },
    ]);

    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    const promise = uploadAsset({ file });

    await tick();
    const xhr = FakeXHR.last;
    xhr.status = 403;
    xhr._triggerLoad();

    await expect(promise).rejects.toThrow('403');
  });

  it('throws when the finalize BFF call fails', async () => {
    mockFetch([
      { ok: true, status: 201, body: { assetId: ASSET_ID, uploadUrl: UPLOAD_URL } },
      { ok: false, status: 502 },
    ]);

    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    const promise = uploadAsset({ file });

    await tick();
    const xhr = FakeXHR.last;
    xhr.status = 200;
    xhr._triggerLoad();

    await expect(promise).rejects.toThrow('502');
  });

  it('throws when fetching the finalized asset fails', async () => {
    mockFetch([
      { ok: true, status: 201, body: { assetId: ASSET_ID, uploadUrl: UPLOAD_URL } },
      { ok: true, status: 204 },
      { ok: false, status: 404 },
    ]);

    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    const promise = uploadAsset({ file });

    await tick();
    const xhr = FakeXHR.last;
    xhr.status = 200;
    xhr._triggerLoad();

    await expect(promise).rejects.toThrow('404');
  });
});
