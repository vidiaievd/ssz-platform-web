import { describe, expect, it } from 'vitest';

import { activityWording } from './activity-wording';

describe('activityWording', () => {
  it('reads the role and the outcome the stored English carries', () => {
    expect(activityWording('school.member.added', 'joined as teacher')).toEqual({ key: 'joined', role: 'teacher' });
    expect(activityWording('exercise.attempt.reviewed', 'reviewed submission — passed')).toEqual({
      key: 'reviewed',
      outcome: 'passed',
    });
    expect(activityWording('learning.enrollment.created', 'enrolled in')).toEqual({ key: 'enrolled' });
  });

  it('keeps the stored text for an event it does not know, or a row without one', () => {
    expect(activityWording('school.something', 'did a thing')).toEqual({ key: null, raw: 'did a thing' });
    expect(activityWording(undefined, 'published')).toEqual({ key: null, raw: 'published' });
  });
});
