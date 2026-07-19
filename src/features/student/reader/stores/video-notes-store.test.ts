import { afterEach, describe, expect, it } from 'vitest';

import { selectLessonNotes, useVideoNotesStore } from './video-notes-store';

afterEach(() => {
  useVideoNotesStore.setState({ notesByLesson: {} });
  window.localStorage.clear();
});

describe('useVideoNotesStore', () => {
  it('starts with no notes for a lesson', () => {
    expect(selectLessonNotes('lesson-1')(useVideoNotesStore.getState())).toEqual([]);
  });

  it('adds a note stamped at the floored timestamp', () => {
    useVideoNotesStore.getState().addNote('lesson-1', 18.9, 'blodprøver = blood samples');
    const notes = selectLessonNotes('lesson-1')(useVideoNotesStore.getState());
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ timestampSeconds: 18, text: 'blodprøver = blood samples' });
  });

  it('keeps notes sorted by timestamp', () => {
    useVideoNotesStore.getState().addNote('lesson-1', 30, 'later');
    useVideoNotesStore.getState().addNote('lesson-1', 5, 'earlier');
    const notes = selectLessonNotes('lesson-1')(useVideoNotesStore.getState());
    expect(notes.map((n) => n.text)).toEqual(['earlier', 'later']);
  });

  it('keeps notes scoped per lesson', () => {
    useVideoNotesStore.getState().addNote('lesson-1', 5, 'a');
    useVideoNotesStore.getState().addNote('lesson-2', 5, 'b');
    expect(selectLessonNotes('lesson-1')(useVideoNotesStore.getState())).toHaveLength(1);
    expect(selectLessonNotes('lesson-2')(useVideoNotesStore.getState())).toHaveLength(1);
  });

  it('persists notes across store instances (same localStorage key)', () => {
    useVideoNotesStore.getState().addNote('lesson-1', 5, 'persisted');
    const persisted = window.localStorage.getItem('ssz:reader:video-notes:v1');
    expect(persisted).toContain('persisted');
  });
});
