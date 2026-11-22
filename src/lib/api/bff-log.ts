/**
 * The BFF's request log: one JSON line per upstream call (OQ-43, plan 76 phase 7).
 *
 * A line carries what a log search needs to follow one page load through the gateway and
 * the services — the correlation id, the service, method, path, status and time — and never
 * a body, a query string or a header: query values can be e-mail addresses or search terms,
 * and the bodies are users' work. The dev-only pretty printer (`LOG_UPSTREAM_REQUESTS`) stays
 * for looking at bodies locally.
 */

export const CORRELATION_HEADER = 'x-correlation-id';

/** Ids we accept from outside: what a UUID or nginx's `$request_id` looks like, nothing that could break a line. */
const CORRELATION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/** The incoming id if it is one we can safely log and pass on, else null. */
export function acceptCorrelationId(value: string | null | undefined): string | null {
  return value && CORRELATION_ID_RE.test(value) ? value : null;
}

export type UpstreamOutcome =
  /** 2xx. */
  | 'ok'
  /** A status the caller declared a normal answer (`expectedErrorStatuses`), or the 401 a refresh answers. */
  | 'expected'
  /** Any other non-2xx answer. */
  | 'error'
  | 'timeout'
  /** No answer at all: connection refused, reset, DNS. */
  | 'network';

export type UpstreamLogEntry = {
  correlationId: string | null;
  service: string;
  method: string;
  /** The path only — the query string is left out on purpose. */
  path: string;
  status: number | null;
  durationMs: number;
  outcome: UpstreamOutcome;
  /** Set when this call is the one retry after a refresh or a dropped socket. */
  retry?: boolean;
};

export type LogLevel = 'info' | 'warn' | 'error';

export function upstreamLogLevel(entry: Pick<UpstreamLogEntry, 'outcome' | 'status'>): LogLevel {
  switch (entry.outcome) {
    case 'ok':
    case 'expected':
      return 'info';
    case 'error':
      return entry.status !== null && entry.status >= 500 ? 'error' : 'warn';
    case 'timeout':
    case 'network':
      return 'error';
  }
}

export function upstreamLogLine(entry: UpstreamLogEntry, now: Date): string {
  return JSON.stringify({
    ts: now.toISOString(),
    level: upstreamLogLevel(entry),
    msg: 'bff.upstream',
    correlationId: entry.correlationId,
    service: entry.service,
    method: entry.method,
    path: entry.path,
    status: entry.status,
    durationMs: entry.durationMs,
    outcome: entry.outcome,
    ...(entry.retry ? { retry: true } : {}),
  });
}

/**
 * Writes the line. In production every call is logged — that is the request log. Elsewhere
 * only warnings and errors are, so a dev console is not buried under a line per widget.
 */
export function logUpstreamCall(entry: UpstreamLogEntry, nodeEnv: string): void {
  const level = upstreamLogLevel(entry);
  if (level === 'info' && nodeEnv !== 'production') return;
  const line = upstreamLogLine(entry, new Date());
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
