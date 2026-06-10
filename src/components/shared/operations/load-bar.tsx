import { cn } from '@/lib/utils';

type LoadBarProps = {
  contact: number;
  cap: number;
  prep?: number;
  label?: string;
  className?: string;
};

export function LoadBar({ contact, cap, prep, label, className }: LoadBarProps) {
  const total = prep !== undefined ? contact + prep : contact;
  const contactPct = cap > 0 ? Math.min((contact / cap) * 100, 100) : 0;
  const prepPct = cap > 0 && prep !== undefined ? Math.min((prep / cap) * 100, 100 - contactPct) : 0;
  const overloaded = total > cap;

  const ariaLabel = label ??
    (prep !== undefined
      ? `${contact.toFixed(1)}h contact + ${prep.toFixed(1)}h prep of ${cap}h cap`
      : `${contact.toFixed(1)}h of ${cap}h cap`);

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round((total / cap) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full rounded-full bg-border overflow-hidden', className)}
    >
      {/* contact segment */}
      <div
        className={cn(
          'h-full float-left rounded-l-full transition-[width]',
          overloaded
            ? 'bg-error-500 dark:bg-error-600'
            : contactPct >= 85
              ? 'bg-warning-500 dark:bg-warning-600'
              : 'bg-primary',
        )}
        style={{ width: `${contactPct}%` }}
        aria-hidden="true"
      />
      {/* prep segment */}
      {prepPct > 0 && (
        <div
          className="h-full float-left transition-[width] bg-primary/40"
          style={{ width: `${prepPct}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
