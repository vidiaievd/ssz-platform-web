import { describe, expect, it } from 'vitest';

import {
  durationsByReviewer,
  median,
  sharesLoad,
  tallyLoad,
  tallySchool,
  type PendingBucket,
} from './oversight';

/** 48 h everywhere unless a course says otherwise — the school's default promise. */
const SCHOOL = 48;
const flat = () => SCHOOL;

describe('median', () => {
  it('takes the middle of an odd count', () => {
    expect(median([10, 1, 5])).toBe(5);
  });

  it('averages the two middle values of an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('is null when nothing was answered at all', () => {
    expect(median([])).toBeNull();
  });

  it('is not dragged by one abandoned submission the way a mean would be', () => {
    // Five answered within a day, one after a fortnight: the school's pace is a day.
    const times = [3, 5, 7, 9, 11, 360];
    expect(median(times)).toBe(8);
    expect(median(times)).toBeLessThan(times.reduce((a, b) => a + b, 0) / times.length);
  });
});

describe('tallyLoad', () => {
  const buckets: PendingBucket[] = [
    { containerId: 'c1', groupId: 'g1', ages: [2, 60] },
    { containerId: 'c2', groupId: 'g2', ages: [100] },
  ];

  it('counts what is past each bucket own promise, not one promise for all', () => {
    // c1 promises 24 h, c2 promises 120 — the same 100 h is late in one and not the other.
    const sla = (id: string | null) => (id === 'c1' ? 24 : 120);
    const tally = tallySchool(buckets, sla);

    expect(tally.pending).toBe(3);
    expect(tally.overdue).toBe(1);
  });

  it('leaves a bucket out entirely when it belongs to no row', () => {
    const tally = tallyLoad([{ containerId: null, groupId: null, ages: [90] }], () => [], flat);
    expect(tally.size).toBe(0);
  });

  it('counts a submission for each of its reviewers, and once for the school', () => {
    const shared: PendingBucket[] = [{ containerId: 'c1', groupId: 'g1', ages: [10, 20] }];
    const reviewers = () => ['t1', 't2'];

    const byTeacher = tallyLoad(shared, reviewers, flat);
    expect(byTeacher.get('t1')?.pending).toBe(2);
    expect(byTeacher.get('t2')?.pending).toBe(2);
    expect(tallySchool(shared, flat).pending).toBe(2);
  });

  it('keeps every age, because the histogram cannot be rebuilt from a count', () => {
    const byGroup = tallyLoad(buckets, (b) => (b.groupId ? [b.groupId] : []), flat);
    expect(byGroup.get('g1')?.ages).toEqual([2, 60]);
  });

  it('counts nothing as late where no promise was made', () => {
    expect(tallySchool(buckets, () => null).overdue).toBe(0);
  });
});

describe('durationsByReviewer', () => {
  it('merges a reviewer answers across every course and group they hold', () => {
    const durations = durationsByReviewer([
      { reviewerId: 't1', containerId: 'c1', groupId: 'g1', durationsHours: [4, 6] },
      { reviewerId: 't1', containerId: 'c2', groupId: 'g2', durationsHours: [8] },
      { reviewerId: 't2', containerId: 'c1', groupId: 'g1', durationsHours: [30] },
    ]);

    expect(durations.get('t1')).toEqual([4, 6, 8]);
    expect(median(durations.get('t1') ?? [])).toBe(6);
    expect(durations.get('t2')).toEqual([30]);
  });
});

describe('sharesLoad', () => {
  const buckets: PendingBucket[] = [
    { containerId: 'c1', groupId: 'g1', ages: [3] },
    { containerId: 'c1', groupId: 'g2', ages: [4] },
  ];
  const reviewersOf = (bucket: PendingBucket) => (bucket.groupId === 'g1' ? ['t1', 't2'] : ['t3']);

  it('is true for a reviewer sharing any of their queue with a colleague', () => {
    expect(sharesLoad(buckets, reviewersOf, 't1')).toBe(true);
  });

  it('is false for one who reviews their groups alone', () => {
    expect(sharesLoad(buckets, reviewersOf, 't3')).toBe(false);
  });

  it('ignores a group with two reviewers and nothing waiting in it', () => {
    expect(sharesLoad([{ containerId: 'c1', groupId: 'g1', ages: [] }], reviewersOf, 't1')).toBe(
      false,
    );
  });
});
