import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';

type WidgetCardProps = {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  /** Accent border variant — used for onboarding checklist. */
  accent?: boolean;
  /** Render skeleton shimmer instead of children. */
  loading?: boolean;
  /**
   * The data could not be fetched (the service is down or does not serve it yet): says so
   * instead of a skeleton that never ends.
   */
  unavailable?: boolean;
  /** Render per-widget error state. Mutually exclusive with loading. */
  error?: string;
  /** Render empty state slot. Used when data exists but is empty. */
  empty?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function WidgetCard({
  title,
  subtitle,
  headerRight,
  accent,
  loading,
  unavailable,
  error,
  empty,
  children,
  className,
}: WidgetCardProps) {
  const t = useTranslations('School.dashboard');
  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm',
        accent ? 'border-primary' : 'border-border',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3 border-b border-border">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-(--ssz-text-primary) leading-snug truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-(--ssz-text-muted) mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : unavailable ? (
          <p className="text-sm text-(--ssz-text-muted)">{t('unavailable')}</p>
        ) : error ? (
          <Alert variant="error" icon={<AlertCircle className="size-4" />} title={error} />
        ) : empty ? (
          empty
        ) : (
          children
        )}
      </div>
    </div>
  );
}
