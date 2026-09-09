'use client';

/** What a step's dot says. `blockers` is the only one that shows a number. */
export type BuilderStepStatus = 'ok' | 'warn' | 'empty' | 'blockers';

export interface BuilderStep {
  n: number;
  label: string;
  /** The half-line under the label: what this step is about, in three or four words. */
  sub?: string;
  status: BuilderStepStatus;
  /** How many things block publishing, when `status` is `blockers`. */
  blockers?: number;
  /**
   * What the status means, in words. Rendered for screen readers only, because the
   * dot is a colour and a colour is never a signal on its own (AC-X7) — and the
   * number in the red badge says how many, not what.
   */
  statusLabel: string;
}

interface BuilderStepRailProps {
  steps: BuilderStep[];
  current: number;
  onSelect: (step: number) => void;
  label: string;
}

const DOT: Record<Exclude<BuilderStepStatus, 'blockers'>, string> = {
  ok: 'bg-success-500',
  warn: 'bg-warning-500',
  empty: 'border-[1.5px] border-dashed border-(--ssz-border-strong)',
};

/**
 * The step rail every builder wears — tabs along the bottom edge of the workspace bar,
 * each with its number, its name, what it is about, and how it is doing (`.wb-rail` in
 * the builder specs).
 *
 * One component rather than four near-identical ones: the four builders differ in how
 * they *work out* a step's state, which is their business, and in nothing about how it
 * is drawn. Each hands over the answer; this draws it.
 */
export function BuilderStepRail({ steps, current, onSelect, label }: BuilderStepRailProps) {
  return (
    <div role="tablist" aria-label={label} className="flex min-w-0 items-stretch overflow-x-auto">
      {steps.map((step) => {
        const isActive = step.n === current;

        return (
          <button
            key={step.n}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(step.n)}
            className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap border-b-2 px-[18px] pt-3 pb-[11px] text-left transition-colors ${
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-(--ssz-text-secondary) hover:text-foreground'
            }`}
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                isActive
                  ? 'bg-primary text-white'
                  : 'bg-(--ssz-bg-muted) text-(--ssz-text-secondary)'
              }`}
            >
              {step.n}
            </span>

            <span className="min-w-0">
              <span className="block text-sm font-medium">{step.label}</span>
              {step.sub !== undefined && (
                <span className="block text-[11px] text-muted-foreground">{step.sub}</span>
              )}
            </span>

            {step.status === 'blockers' ? (
              <span className="grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-error px-1.5 text-[11px] font-bold text-white">
                {step.blockers}
              </span>
            ) : (
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[step.status]}`} />
            )}
            <span className="sr-only">{step.statusLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
