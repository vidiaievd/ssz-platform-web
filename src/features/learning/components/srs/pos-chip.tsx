import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PosChipProps {
  pos: string;
  className?: string;
}

export function PosChip({ pos, className }: PosChipProps) {
  return (
    <Badge
      variant="muted"
      className={cn(
        'bg-[var(--ssz-bg-subtle)] text-[var(--ssz-text-secondary)] text-xs uppercase tracking-[var(--ssz-tracking-wide)] font-medium rounded-[var(--ssz-radius-full)]',
        className,
      )}
    >
      {pos}
    </Badge>
  );
}
