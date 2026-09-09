import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAnswerDraft,
  clearAnswerDrafts,
  readAnswerDraft,
  saveAnswerDraft,
} from './answer-draft';

const ANSWER = { 'item-1': 'Jeg har bodd her i tre år.' };

describe('the unsent answer draft', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('has nothing to give back before anything is written', () => {
    expect(readAnswerDraft('ex-1')).toBeNull();
  });

  it('gives back what was written, across what a reload would forget', () => {
    saveAnswerDraft('ex-1', ANSWER);

    expect(readAnswerDraft('ex-1')).toEqual(ANSWER);
  });

  it('keeps one exercise’s draft out of another’s field', () => {
    saveAnswerDraft('ex-1', ANSWER);

    expect(readAnswerDraft('ex-2')).toBeNull();
  });

  it('replaces the earlier draft rather than piling up', () => {
    saveAnswerDraft('ex-1', ANSWER);
    saveAnswerDraft('ex-1', { 'item-1': 'Jeg har bodd her i fire år.' });

    expect(readAnswerDraft('ex-1')).toEqual({ 'item-1': 'Jeg har bodd her i fire år.' });
  });

  it('clears rather than stores when the learner wiped the field', () => {
    saveAnswerDraft('ex-1', ANSWER);
    saveAnswerDraft('ex-1', {});

    expect(readAnswerDraft('ex-1')).toBeNull();
  });

  it('drops the draft once the work has reached the engine', () => {
    saveAnswerDraft('ex-1', ANSWER);
    clearAnswerDraft('ex-1');

    expect(readAnswerDraft('ex-1')).toBeNull();
  });

  it('forgets a draft old enough that the exercise has moved on without it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:00:00Z'));
    saveAnswerDraft('ex-1', ANSWER);

    vi.setSystemTime(new Date('2026-08-09T10:00:00Z'));

    expect(readAnswerDraft('ex-1')).toBeNull();
    // Gone from storage too, not merely withheld from the caller.
    expect(window.localStorage.getItem('exercise-answer-draft:ex-1')).toBeNull();
  });

  it('ignores a stored entry it cannot read instead of throwing into the runner', () => {
    window.localStorage.setItem('exercise-answer-draft:ex-1', 'not json');

    expect(readAnswerDraft('ex-1')).toBeNull();
  });

  it('is emptied outright on sign-out — these are the learner’s own words', () => {
    saveAnswerDraft('ex-1', ANSWER);
    saveAnswerDraft('ex-2', ANSWER);
    window.localStorage.setItem('unrelated', 'kept');

    clearAnswerDrafts();

    expect(readAnswerDraft('ex-1')).toBeNull();
    expect(readAnswerDraft('ex-2')).toBeNull();
    expect(window.localStorage.getItem('unrelated')).toBe('kept');
  });
});
