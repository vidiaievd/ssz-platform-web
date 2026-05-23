import { cn } from '@/lib/utils';

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}

export function StatCard({
  className,
  label,
  value,
  icon,
  color = 'oklch(0.62 0.105 168)',
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3.5 rounded-xl p-[18px]',
        'bg-[var(--ssz-bg-surface)] border border-border shadow-sm',
        className,
      )}
      {...props}
    >
      <div
        className="size-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}1a` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div
          className="text-[22px] font-bold leading-none tabular-nums"
          style={{ color: 'var(--ssz-text-primary)' }}
        >
          {value}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--ssz-text-muted)' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
