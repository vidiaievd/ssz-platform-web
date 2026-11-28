import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  acceptCorrelationId,
  logUpstreamCall,
  upstreamLogLevel,
  upstreamLogLine,
  type UpstreamLogEntry,
} from './bff-log';

const ENTRY: UpstreamLogEntry = {
  correlationId: '3f2c8a1e-5b7d-4c9a-8e21-0d6f4b3a9c10',
  service: 'organization',
  method: 'GET',
  path: '/api/v1/schools/abc',
  status: 200,
  durationMs: 42,
  outcome: 'ok',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('acceptCorrelationId', () => {
  it('keeps a UUID and an nginx request id', () => {
    expect(acceptCorrelationId(ENTRY.correlationId)).toBe(ENTRY.correlationId);
    expect(acceptCorrelationId('9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d')).toBe('9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d');
  });

  it('refuses anything that could break or forge a log line', () => {
    expect(acceptCorrelationId('abc"}\n{"level":"info')).toBeNull();
    expect(acceptCorrelationId('short')).toBeNull();
    expect(acceptCorrelationId('a'.repeat(65))).toBeNull();
    expect(acceptCorrelationId('')).toBeNull();
    expect(acceptCorrelationId(null)).toBeNull();
  });
});

describe('upstreamLogLevel', () => {
  it('reads a normal answer and an expected refusal as info', () => {
    expect(upstreamLogLevel({ outcome: 'ok', status: 200 })).toBe('info');
    expect(upstreamLogLevel({ outcome: 'expected', status: 404 })).toBe('info');
  });

  it('reads an unexpected 4xx as a warning and a 5xx as an error', () => {
    expect(upstreamLogLevel({ outcome: 'error', status: 409 })).toBe('warn');
    expect(upstreamLogLevel({ outcome: 'error', status: 502 })).toBe('error');
  });

  it('reads no answer at all as an error', () => {
    expect(upstreamLogLevel({ outcome: 'timeout', status: null })).toBe('error');
    expect(upstreamLogLevel({ outcome: 'network', status: null })).toBe('error');
  });
});

describe('upstreamLogLine', () => {
  it('is one JSON object with the fields a search needs', () => {
    const line = upstreamLogLine(ENTRY, new Date('2026-11-22T12:00:00.000Z'));

    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({
      ts: '2026-11-22T12:00:00.000Z',
      level: 'info',
      msg: 'bff.upstream',
      correlationId: ENTRY.correlationId,
      service: 'organization',
      method: 'GET',
      path: '/api/v1/schools/abc',
      status: 200,
      durationMs: 42,
      outcome: 'ok',
    });
  });

  it('marks a retry', () => {
    expect(JSON.parse(upstreamLogLine({ ...ENTRY, retry: true }, new Date())).retry).toBe(true);
  });
});

describe('logUpstreamCall', () => {
  it('logs every call in production', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logUpstreamCall(ENTRY, 'production');
    expect(log).toHaveBeenCalledOnce();
  });

  it('keeps a dev console to warnings and errors', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logUpstreamCall(ENTRY, 'development');
    logUpstreamCall({ ...ENTRY, status: 409, outcome: 'error' }, 'development');
    logUpstreamCall({ ...ENTRY, status: null, outcome: 'timeout' }, 'development');

    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});
