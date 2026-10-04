'use client';

import { AlertTriangle, Info } from 'lucide-react';

export interface Note {
  key: string;
  level: 'blocker' | 'warning' | 'info';
  text: string;
}

const TONE = {
  blocker: 'text-(--ssz-color-error-700)',
  warning: 'text-(--ssz-color-warning-700)',
  info: 'text-(--ssz-text-muted)',
} as const;

/**
 * What the issue list says about this part of a step, drawn where it can be fixed (AC-B1:
 * a new exercise shows the missing clip on step 1). The kernel's findings and the audio
 * layer's go through here as the same kind of row; `data-level` is for tests and styling.
 */
export function Notes({ notes }: { notes: readonly Note[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {notes.map((note) => {
        const Icon = note.level === 'info' ? Info : AlertTriangle;
        return (
          <li
            key={note.key}
            data-level={note.level}
            className={`flex items-start gap-[5px] text-xs ${TONE[note.level]}`}
          >
            <Icon size={13} aria-hidden="true" className="mt-px shrink-0" />
            <span>{note.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
