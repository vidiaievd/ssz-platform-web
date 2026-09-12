import { Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export type NoteTone = 'neutral' | 'warn';

export interface NoteProps {
  children: ReactNode;
  tone?: NoteTone;
  icon?: 'info' | 'warn';
}

/**
 * The small note under a chart or a grid, and the one component that carries the tone
 * rule of the brief: **explain the data, never accuse the reader**.
 *
 * Most of what these screens show is emptiness, and almost all of that emptiness is the
 * platform's doing rather than a teacher's — no listening content is published, no
 * classwork is recorded. Said plainly in a note, that is information; left unsaid beside
 * an empty grid, it reads as an accusation. Neutral is the default for exactly that
 * reason.
 */
export function Note({ children, tone = 'neutral', icon = 'info' }: NoteProps) {
  const Glyph = icon === 'warn' ? TriangleAlert : Info;
  const warn = tone === 'warn';

  return (
    <div
      className="flex items-start gap-[9px] rounded-[11px] px-3 py-2.5"
      style={{
        background: warn ? 'oklch(var(--ssz-secondary-ch) / 0.14)' : 'var(--ssz-bg-subtle)',
        border: `1px solid ${warn ? 'oklch(var(--ssz-secondary-ch) / 0.45)' : 'var(--ssz-border-default)'}`,
      }}
    >
      <Glyph
        size={15}
        className="mt-px shrink-0"
        style={{ color: warn ? 'oklch(var(--ssz-secondary-ch))' : 'var(--ssz-text-muted)' }}
        aria-hidden
      />
      <div className="text-[12.5px] leading-[1.55] text-(--ssz-text-secondary)">{children}</div>
    </div>
  );
}
