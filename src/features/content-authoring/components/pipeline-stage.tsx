'use client';

import type { LucideIcon } from 'lucide-react';

export interface PipelineStageProps {
  icon: LucideIcon;
  /** When this stage happens — `now`, `stage 2`, `final`. */
  when: string;
  title: string;
  body: string;
  /** `preview` / `off`, for a stage that is drawn but not connected. */
  tag?: string;
  /** Dims the box. A stage that is switched off is still drawn: the shape is the point. */
  off?: boolean;
}

/**
 * One box in a builder's grading-pipeline diagram.
 *
 * Shared by the two templates whose answers a person reads — `writing_task` and
 * `short_answer`. The diagram exists to say what a document is about to do to a student's
 * answer *in order*, and a stage that is switched off is dimmed rather than dropped: the
 * author needs to see the slot the AI check will occupy, not infer it from an absence.
 *
 * Nothing here is interactive. The switches sit underneath, where they read as settings
 * rather than as parts of a machine.
 */
export function PipelineStage({
  icon: Icon,
  when,
  title,
  body,
  tag,
  off = false,
}: PipelineStageProps) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border border-border p-3 ${off ? 'opacity-55' : ''}`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3" aria-hidden />
        {when}
      </span>
      <strong className="text-sm">{title}</strong>
      <p className="text-xs text-muted-foreground">{body}</p>
      {tag !== undefined && (
        <span className="mt-1 w-fit rounded-full bg-subtle px-2 py-0.5 text-[11px] text-muted-foreground">
          {tag}
        </span>
      )}
    </div>
  );
}
