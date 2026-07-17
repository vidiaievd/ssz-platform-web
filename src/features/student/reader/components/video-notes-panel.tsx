'use client';

import { useState } from 'react';
import { PenLine, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatTimecode } from '@/features/learning';
import { cn } from '@/lib/utils';

import { selectLessonNotes, useVideoNotesStore } from '../stores/video-notes-store';

export interface VideoNotesPanelProps {
  lessonId: string;
  /** Current playback position, in seconds — new notes are stamped here. */
  currentTime: number;
  className?: string;
}

/** Per-user, per-lesson timecode-stamped notes (design handoff `VLNotes`). */
export function VideoNotesPanel({ lessonId, currentTime, className }: VideoNotesPanelProps) {
  const t = useTranslations('Learning.reader.video.notes');
  const notes = useVideoNotesStore(selectLessonNotes(lessonId));
  const addNote = useVideoNotesStore((s) => s.addNote);
  const [draft, setDraft] = useState('');

  function submit() {
    const text = draft.trim();
    if (!text) return;
    addNote(lessonId, currentTime, text);
    setDraft('');
  }

  return (
    <div
      className={cn(
        'rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface p-4 shadow-(--ssz-shadow-sm)',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <PenLine size={16} className="text-(--ssz-color-primary-700)" aria-hidden="true" />
        <span className="text-sm font-bold text-(--ssz-text-primary)">{t('heading')}</span>
        <span className="ml-auto text-[11px] text-(--ssz-text-muted)">
          {t('atTimestamp', { time: formatTimecode(currentTime) })}
        </span>
      </div>

      <div className="mb-3.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={t('placeholder')}
          className="flex-1 rounded-lg border-[1.5px] border-(--ssz-border-default) bg-(--ssz-bg-base) px-2.75 py-2 text-sm text-(--ssz-text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)"
        />
        <button
          type="button"
          onClick={submit}
          aria-label={t('add')}
          disabled={!draft.trim()}
          className="flex items-center rounded-lg bg-(--ssz-color-primary-600) px-3 text-white disabled:opacity-40"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {notes.length === 0 && <p className="text-[12.5px] leading-relaxed text-(--ssz-text-muted)">{t('empty')}</p>}
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex gap-2.5 rounded-md border border-(--ssz-border-default) bg-(--ssz-bg-base) px-2.75 py-2.25"
          >
            <span className="mt-px shrink-0 font-mono text-[11px] font-bold text-(--ssz-color-primary-600)">
              {formatTimecode(note.timestampSeconds)}
            </span>
            <span className="flex-1 text-[13px] leading-relaxed text-(--ssz-text-primary)">{note.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
