import { describe, expect, it } from 'vitest';

import { readWritingTaskDetails } from './writing-task-details';

const details = {
  totalItems: 1,
  passedItems: 0,
  wordCount: 187,
  paragraphs: 3,
  uniqueWords: 112,
  length: 'ok',
  hitCount: 2,
  neededCount: 3,
  points: [
    { id: 'p1', text: 'Hvor du bor', required: true, hit: true, ticked: true },
    { id: 'p2', text: 'Hva du jobber med', required: true, hit: false, ticked: true },
  ],
};

describe('readWritingTaskDetails', () => {
  it("reads the engine's own breakdown through unchanged", () => {
    expect(readWritingTaskDetails(details)).toEqual(details);
  });

  // The breakdown is recomputed against the exercise as it stands today, so an old
  // submission comes back shaped like the old template. A partly-filled object would
  // print "0 ord" over a 200-word essay; a missing one is visibly missing.
  it('refuses a breakdown from before the rewrite rather than filling in zeros', () => {
    expect(readWritingTaskDetails({ totalItems: 1, passedItems: 0, items: [] })).toBeNull();
    expect(readWritingTaskDetails(null)).toBeNull();
    expect(readWritingTaskDetails([])).toBeNull();
  });

  it('refuses a length it does not recognise', () => {
    expect(readWritingTaskDetails({ ...details, length: 'medium' })).toBeNull();
  });

  it('takes no points as an exercise with no points, not as a stale payload', () => {
    const read = readWritingTaskDetails({ ...details, points: [] });

    expect(read).not.toBeNull();
    expect(read!.points).toEqual([]);
  });

  it('drops a point with no id and keeps the rest', () => {
    const read = readWritingTaskDetails({
      ...details,
      points: [{ text: 'no id here', hit: true }, details.points[1]],
    });

    expect(read!.points).toEqual([details.points[1]]);
  });

  it('reads a point defensively — a missing flag is false, a missing required is true', () => {
    const read = readWritingTaskDetails({ ...details, points: [{ id: 'p9' }] });

    expect(read!.points).toEqual([
      { id: 'p9', text: '', required: true, hit: false, ticked: false },
    ]);
  });
});
