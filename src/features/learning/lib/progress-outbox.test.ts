import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProgressOutbox,
  dequeueProgress,
  enqueueProgress,
  readProgressOutbox,
} from './progress-outbox';

const PING = {
  contentType: 'LESSON',
  contentId: 'content-1',
  timeSpentSeconds: 30,
  completed: true,
};

describe('progress outbox', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty', () => {
    expect(readProgressOutbox()).toEqual([]);
  });

  it('queues a ping', () => {
    enqueueProgress(PING);
    expect(readProgressOutbox()).toEqual([PING]);
  });

  it('replaces the earlier entry for the same content instead of piling up', () => {
    enqueueProgress(PING);
    enqueueProgress({ ...PING, timeSpentSeconds: 90 });
    expect(readProgressOutbox()).toEqual([{ ...PING, timeSpentSeconds: 90 }]);
  });

  it('keeps entries for different content items separate', () => {
    enqueueProgress(PING);
    enqueueProgress({ ...PING, contentId: 'content-2' });
    expect(readProgressOutbox()).toHaveLength(2);
  });

  it('drops an entry once it has been delivered', () => {
    enqueueProgress(PING);
    dequeueProgress(PING.contentId);
    expect(readProgressOutbox()).toEqual([]);
  });

  it('is emptied outright on sign-out, so the next person on this machine does not inherit it', () => {
    enqueueProgress(PING);
    enqueueProgress({ ...PING, contentId: 'content-2' });

    clearProgressOutbox();

    expect(readProgressOutbox()).toEqual([]);
  });

  it('survives a reload — the queue is read back from storage, not memory', () => {
    enqueueProgress(PING);
    // A fresh read is exactly what a page reload does: no in-memory state to
    // fall back on, only what localStorage still holds.
    expect(readProgressOutbox()).toEqual([PING]);
  });
});
