// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { ReviewBlockOccurrence } from '@/lib/scheduling/provider';
import { queueForecast, type ReviewEffort } from './queue-forecast';

const sitting = (date: string, start: string, end: string): ReviewBlockOccurrence => ({
  blockId: 'block',
  schoolId: 'school',
  teacherId: 'teacher',
  repeat: 'weekly',
  date,
  start,
  end,
  note: null,
});

const effort: ReviewEffort = {
  pending: [
    { groupId: 'mine', templateCode: 'writing_task', count: 5 },
    { groupId: 'mine', templateCode: 'short_answer', count: 6 },
    { groupId: 'theirs', templateCode: 'writing_task', count: 40 },
    { groupId: null, templateCode: 'writing_task', count: 9 },
  ],
  norms: [
    { templateCode: 'writing_task', minutesPerSubmission: 12 },
    { templateCode: 'short_answer', minutesPerSubmission: 2 },
  ],
};

const window = { from: '2026-10-28', to: '2026-11-01' };

describe('queueForecast', () => {
  it('counts only the groups the teacher reviews, at the norm of each template', () => {
    const forecast = queueForecast({
      effort,
      reviewersByGroup: new Map([['mine', 1]]),
      occurrences: [],
      ...window,
    });

    // 5 × 12 + 6 × 2 = 72 minutes.
    expect(forecast.pending).toBe(11);
    expect(forecast.hoursNeeded).toBe(1.2);
    expect(forecast.shared).toBe(false);
  });

  it('holds only the sittings left in the window', () => {
    const forecast = queueForecast({
      effort,
      reviewersByGroup: new Map([['mine', 1]]),
      occurrences: [
        sitting('2026-10-27', '09:00', '11:00'),
        sitting('2026-10-28', '09:00', '10:30'),
        sitting('2026-11-01', '18:00', '18:30'),
        sitting('2026-11-02', '09:00', '11:00'),
      ],
      ...window,
    });

    expect(forecast.hoursHeld).toBe(2);
    expect(forecast.overloaded).toBe(false);
  });

  it('signals a queue a quarter and half an hour over the held time', () => {
    const over = queueForecast({
      effort,
      reviewersByGroup: new Map([['mine', 1]]),
      occurrences: [sitting('2026-10-28', '09:00', '09:30')],
      ...window,
    });
    expect(over.overloaded).toBe(true);

    // 72 minutes against 60 is over by a fifth — within what the norms can promise.
    const near = queueForecast({
      effort,
      reviewersByGroup: new Map([['mine', 1]]),
      occurrences: [sitting('2026-10-28', '09:00', '10:00')],
      ...window,
    });
    expect(near.overloaded).toBe(false);
  });

  it('does not signal a small queue with nothing held', () => {
    const forecast = queueForecast({
      effort: { ...effort, pending: [{ groupId: 'mine', templateCode: 'short_answer', count: 6 }] },
      reviewersByGroup: new Map([['mine', 1]]),
      occurrences: [],
      ...window,
    });

    expect(forecast.hoursNeeded).toBe(0.2);
    expect(forecast.overloaded).toBe(false);
  });

  it('marks work in a group the teacher shares with another reviewer', () => {
    const forecast = queueForecast({
      effort,
      reviewersByGroup: new Map([
        ['mine', 1],
        ['theirs', 2],
      ]),
      occurrences: [],
      ...window,
    });

    expect(forecast.pending).toBe(51);
    expect(forecast.shared).toBe(true);
  });

  it('refuses a template the engine gave no norm for', () => {
    expect(() =>
      queueForecast({
        effort: { pending: [{ groupId: 'mine', templateCode: 'dictation', count: 1 }], norms: [] },
        reviewersByGroup: new Map([['mine', 1]]),
        occurrences: [],
        ...window,
      }),
    ).toThrow(/dictation/);
  });
});
