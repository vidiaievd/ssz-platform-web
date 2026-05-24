'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { CheckSeverity, PreflightCheck, PreflightResult } from '../types';
import { authoringKeys } from '../api/keys';

// ─── Icon per severity ────────────────────────────────────────────────────────

function CheckIcon({ severity }: { severity: CheckSeverity }) {
  if (severity === 'blocker')
    return <XCircle className="h-4 w-4 shrink-0 text-error" aria-hidden />;
  if (severity === 'warning')
    return <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" aria-hidden />;
  return <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden />;
}

// ─── Single check row ─────────────────────────────────────────────────────────

function CheckRow({ check }: { check: PreflightCheck }) {
  return (
    <li
      className="flex items-start gap-2 py-1.5"
      aria-label={`${check.severity === 'blocker' ? 'Blocker' : check.severity === 'warning' ? 'Warning' : 'OK'}: ${check.title}`}
    >
      <CheckIcon severity={check.severity} />
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm',
            check.severity === 'ok' && 'line-through text-muted-foreground',
          )}
        >
          {check.title}
        </span>
        {check.fixHint && (
          <p className="text-xs text-muted-foreground mt-0.5">{check.fixHint}</p>
        )}
      </div>
      {check.fixDeepLink && (
        <Link
          href={check.fixDeepLink as never}
          className="shrink-0 flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          Fix <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </li>
  );
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PreflightHeader({ result }: { result: PreflightResult }) {
  const { blockerCount, warningCount } = result;

  if (blockerCount === 0 && warningCount === 0) {
    return (
      <div className="flex items-center gap-2 text-success-700">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-sm font-medium">All checks passed — ready to publish</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <AlertTriangle className={cn('h-4 w-4', blockerCount > 0 ? 'text-error' : 'text-warning-600')} />
      <span className="text-sm font-medium">
        {blockerCount > 0 && <span className="text-error">{blockerCount} blocker{blockerCount !== 1 ? 's' : ''}</span>}
        {blockerCount > 0 && warningCount > 0 && <span className="text-muted-foreground"> · </span>}
        {warningCount > 0 && <span className="text-warning-600">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">
        {blockerCount > 0 ? 'cannot publish' : 'can publish with warnings'}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PreflightPanelProps {
  containerId: string;
  /** Pass a pre-computed result to skip fetching (e.g. computed client-side in the wizard). */
  result?: PreflightResult;
  /** Show "Publish anyway" footer action (owner only). */
  onPublishAnyway?: () => void;
}

export function PreflightPanel({ containerId, result: resultProp, onPublishAnyway }: PreflightPanelProps) {
  const { data, isLoading, error, refetch } = useQuery<PreflightResult>({
    queryKey: authoringKeys.preflight(containerId),
    queryFn: async () => {
      const res = await fetch(`/api/content/containers/${containerId}/preflight`);
      if (!res.ok) throw new Error('Preflight failed');
      return res.json() as Promise<PreflightResult>;
    },
    staleTime: 20_000,
    enabled: !resultProp, // skip fetch when caller provides result
  });

  const result = resultProp ?? data;

  if (isLoading && !result) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <p>Could not run pre-flight check.</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => void refetch()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <PreflightHeader result={result} />
      </div>

      <ul className="divide-y divide-border px-4" role="list">
        {result.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </ul>

      {(result.canPublishAnyway || result.canPublish) && onPublishAnyway && (
        <div className="border-t border-border px-4 py-3 flex justify-end gap-2">
          {result.canPublishAnyway && !result.canPublish && (
            <Button variant="outline" size="sm" onClick={onPublishAnyway}>
              Publish anyway
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
