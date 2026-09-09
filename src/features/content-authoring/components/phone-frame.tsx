import type { ReactNode } from 'react';

interface PhoneFrameProps {
  children: ReactNode;
  /** Names the scrollable pane — what a screen reader announces on entering it. */
  label?: string;
  className?: string;
}

/**
 * Device-chrome mockup wrapping the "student sees exactly this" preview in the
 * lesson editor (FE2.1, design_handoff_course_management/coursemgmt/LessonPreview.jsx).
 * The bezel is a fixed neutral, not themed — it represents a physical phone, not app UI.
 */
export function PhoneFrame({ children, label, className }: PhoneFrameProps) {
  return (
    <div
      className={`w-75 shrink-0 overflow-hidden rounded-[34px] border-8 shadow-(--ssz-shadow-lg) ${className ?? ''}`}
      style={{ borderColor: 'oklch(0.28 0.01 240)', background: 'var(--ssz-bg-base)' }}
    >
      <div
        className="flex h-6.5 items-center justify-center"
        style={{ background: 'oklch(0.28 0.01 240)' }}
      >
        <div
          className="h-1.25 w-17.5 rounded-full"
          style={{ background: 'oklch(0.42 0.01 240)' }}
        />
      </div>
      {/*
        Focusable because it scrolls. A pane a mouse can scroll and a keyboard cannot is
        a preview only half the room can read — and the preview is the whole point of the
        frame (axe `scrollable-region-focusable`).
      */}
      <div
        tabIndex={0}
        aria-label={label}
        className="h-124.5 overflow-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--ssz-border-strong)"
        style={{ background: 'var(--ssz-bg-base)' }}
      >
        {children}
      </div>
    </div>
  );
}
