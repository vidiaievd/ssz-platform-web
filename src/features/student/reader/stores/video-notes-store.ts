'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VideoNote {
  id: string;
  /** Floored playback position, in seconds, the note was added at. */
  timestampSeconds: number;
  text: string;
}

interface VideoNotesState {
  /** lessonId -> notes, sorted by timestamp. */
  notesByLesson: Record<string, VideoNote[]>;
  addNote: (lessonId: string, timestampSeconds: number, text: string) => void;
}

/**
 * Per-user, per-lesson, timecode-stamped video notes (design handoff
 * `VLNotes`). No backend field exists for this yet (see plan 29 — no BE
 * ticket covers notes), so this is persisted client-side, matching the
 * reading-mode-store convention.
 */
export const useVideoNotesStore = create<VideoNotesState>()(
  persist(
    (set) => ({
      notesByLesson: {},
      addNote: (lessonId, timestampSeconds, text) =>
        set((state) => {
          const existing = state.notesByLesson[lessonId] ?? [];
          const note: VideoNote = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestampSeconds: Math.floor(timestampSeconds),
            text,
          };
          const notes = [...existing, note].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
          return { notesByLesson: { ...state.notesByLesson, [lessonId]: notes } };
        }),
    }),
    { name: 'ssz:reader:video-notes:v1' },
  ),
);

const EMPTY_NOTES: VideoNote[] = [];

export function selectLessonNotes(lessonId: string) {
  return (state: VideoNotesState) => state.notesByLesson[lessonId] ?? EMPTY_NOTES;
}
