import type { ReactNode } from 'react';

interface DesktopFrameProps {
  children: ReactNode;
  /** Names the scrollable pane — what a screen reader announces on entering it. */
  label?: string;
}

/**
 * The counterpart to `PhoneFrame`: the "student sees exactly this" preview at the
 * width a reader has on a laptop.
 *
 * Same purpose as the phone bezel — say whose screen this is — and the same reason
 * for the chrome to be a fixed neutral rather than themed: it stands for a window,
 * not for our UI. The content is held to the reader's own column width, because a
 * preview stretched to the editor's full width would be showing a layout no student
 * ever gets.
 */
export function DesktopFrame({ children, label }: DesktopFrameProps) {
  return (
    <div
      className="w-full overflow-hidden rounded-2xl border-4 shadow-(--ssz-shadow-lg)"
      style={{ borderColor: 'oklch(0.28 0.01 240)', background: 'var(--ssz-bg-base)' }}
    >
      <div
        className="flex h-7 items-center gap-1.5 px-3"
        style={{ background: 'oklch(0.28 0.01 240)' }}
      >
        {['oklch(0.55 0.18 25)', 'oklch(0.72 0.15 85)', 'oklch(0.62 0.14 150)'].map((dot) => (
          <span key={dot} className="size-2 rounded-full" style={{ background: dot }} />
        ))}
      </div>
      {/*
        Focusable because it scrolls — a pane a mouse can scroll and a keyboard cannot
        is a preview only half the room can read (axe `scrollable-region-focusable`).
      */}
      <div
        tabIndex={0}
        aria-label={label}
        className="max-h-[70vh] overflow-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--ssz-border-strong)"
        style={{ background: 'var(--ssz-bg-base)' }}
      >
        {/*
          The reader's own column, centred the way the reader centres it — and never
          narrower than the width at which a layout stops being the desktop one. On a
          small laptop, where the panel cannot be that wide, the frame scrolls
          sideways: a "desktop preview" showing the phone layout would be a lie, and
          the scrollbar is the honest version of not having the room.
        */}
        <div className="mx-auto w-full max-w-[820px] min-w-[720px]">{children}</div>
      </div>
    </div>
  );
}
