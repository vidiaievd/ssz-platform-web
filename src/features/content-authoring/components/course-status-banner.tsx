import { cn } from '@/lib/utils';
import type { Container } from '@/features/content/types';
import type { ContainerState } from '../types';
import { deriveContainerState } from './container-state-badge';

const BANNER_CONFIG: Record<
  ContainerState,
  {
    bg: string;
    text: string;
    inlineAction?: { label: string; href?: string; action?: string };
  }
> = {
  draft: {
    bg: 'bg-warning-50 border-warning-200',
    text: 'text-warning-800',
    inlineAction: { label: 'Run pre-flight' },
  },
  published: {
    bg: 'bg-success-50 border-success-200',
    text: 'text-success-800',
    inlineAction: { label: 'Archive…', action: 'archive' },
  },
  archived: {
    bg: 'bg-muted border-border',
    text: 'text-muted-foreground',
  },
};

const STATUS_COPY: Record<ContainerState, (container: Container) => string> = {
  draft:     () => 'Draft · not visible to students',
  published: (c) => `Published · ${c.lessonCount ?? 0} lessons available`,
  archived:  () => 'Archived · read-only · no new enrolments',
};

interface CourseStatusBannerProps {
  container: Container;
  blockerCount?: number;
  warningCount?: number;
  onInlineAction?: (action: string) => void;
}

export function CourseStatusBanner({
  container,
  blockerCount,
  warningCount,
  onInlineAction,
}: CourseStatusBannerProps) {
  const state = deriveContainerState(container);
  const cfg = BANNER_CONFIG[state];

  return (
    <div className={cn('rounded-lg border px-4 py-3 flex items-start justify-between gap-4', cfg.bg)}>
      <div>
        <p className={cn('text-sm font-medium', cfg.text)}>
          {STATUS_COPY[state](container)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
          <span>Last edited {new Date(container.updatedAt).toLocaleDateString()}</span>
          {state === 'draft' && blockerCount != null && blockerCount > 0 && (
            <span className="text-error font-medium">
              · {blockerCount} blocker{blockerCount !== 1 ? 's' : ''}
              {warningCount ? `, ${warningCount} warnings` : ''}
            </span>
          )}
          {state === 'draft' && blockerCount === 0 && warningCount != null && warningCount > 0 && (
            <span className="text-warning-700 font-medium">
              · {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {cfg.inlineAction && onInlineAction && (
        <button
          type="button"
          onClick={() => onInlineAction(cfg.inlineAction!.action ?? 'preflight')}
          className="shrink-0 text-xs font-medium underline-offset-2 hover:underline text-muted-foreground"
        >
          {cfg.inlineAction.label}
        </button>
      )}
    </div>
  );
}
