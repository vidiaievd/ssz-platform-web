import type { ReactNode } from 'react';

interface DesktopFrameProps {
  children: ReactNode;
  /** Names the scrollable pane — what a screen reader announces on entering it. */
  label?: string;
  /** Shown in the window's location bar. The reader's own address, not a made-up one. */
  address?: string;
}

/**
 * The counterpart to `PhoneFrame`: the "student sees exactly this" preview at the
 * width a reader has on a laptop.
 *
 * A window rather than a device — light chrome, a location bar, a soft shadow
 * (`.mp-desk` in the builder specs). The phone gets a heavy black bezel because it
 * stands for a physical object; a browser window is a piece of software, and drawing
 * it as a slab of hardware made the preview look like a second app.
 */
export function DesktopFrame({ children, label, address }: DesktopFrameProps) {
  return (
    <div className="w-full max-w-[1040px] overflow-hidden rounded-xl border border-border bg-surface shadow-(--ssz-shadow-lg)">
      <div className="flex items-center gap-1.5 border-b border-border bg-(--ssz-bg-subtle) px-3 py-2.5">
        <span className="size-2.25 rounded-full bg-(--ssz-bg-muted)" />
        <span className="size-2.25 rounded-full bg-(--ssz-bg-muted)" />
        <span className="size-2.25 rounded-full bg-(--ssz-bg-muted)" />
        {address !== undefined && (
          <span className="ml-2.5 truncate font-mono text-[10px] text-muted-foreground">
            {address}
          </span>
        )}
      </div>
      {/*
        Focusable because it scrolls — a pane a mouse can scroll and a keyboard cannot
        is a preview only half the room can read (axe `scrollable-region-focusable`).
      */}
      <div
        tabIndex={0}
        aria-label={label}
        className="overflow-auto p-6 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--ssz-border-strong)"
        style={{ background: 'var(--ssz-bg-base)' }}
      >
        {/*
          Never narrower than the width at which a layout stops being the desktop one
          (`POOL_COLUMN_AT` and its like). A "desktop preview" quietly showing the
          phone layout would be a lie; a scrollbar is the honest version of not having
          the room, and at the panel's normal width it never appears.
        */}
        <div className="min-w-[672px]">{children}</div>
      </div>
    </div>
  );
}
