import type { UpsertProgressRequest } from '../types';

const KEY = 'learning-progress-outbox';

function readRaw(): UpsertProgressRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UpsertProgressRequest[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: UpsertProgressRequest[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable — the ping is lost, same as if it had never
    // been queued. Nothing here is worth surfacing to the learner over a checkbox.
  }
}

/** The queued progress pings that never made it to the server, oldest first. */
export function readProgressOutbox(): UpsertProgressRequest[] {
  return readRaw();
}

/**
 * Queues one ping, replacing any earlier one for the same content item.
 * The ping is idempotent (upsert by user+content), so only the latest record
 * per item is worth keeping — deduplication is free.
 */
export function enqueueProgress(entry: UpsertProgressRequest): void {
  const rest = readRaw().filter((e) => e.contentId !== entry.contentId);
  writeRaw([...rest, entry]);
}

/** Drops one entry once it has made it to the server. */
export function dequeueProgress(contentId: string): void {
  writeRaw(readRaw().filter((e) => e.contentId !== contentId));
}
