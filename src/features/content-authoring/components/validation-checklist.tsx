'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronRight, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';

import type { CheckSeverity, PreflightCheck } from '../types';
import { usePreflightCheckText } from '../lib/preflight-check-text';

// ── Icons ─────────────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: CheckSeverity }) {
  if (severity === 'blocker')
    return <XCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden />;
  if (severity === 'warning')
    return <AlertTriangle className="h-4 w-4 text-warning-700 shrink-0" aria-hidden />;
  return <CheckCircle2 className="h-4 w-4 text-success-700 shrink-0" aria-hidden />;
}

// ── Single check row ──────────────────────────────────────────────────────────

function CheckRow({ check }: { check: PreflightCheck }) {
  const t = useTranslations('Authoring.checklist');
  const checkText = usePreflightCheckText();
  const { title, fixHint } = checkText(check);
  const severityLabel =
    check.severity === 'blocker' ? 'Blocker' : check.severity === 'warning' ? 'Warning' : 'OK';
  return (
    <li className="flex items-start gap-2 py-2" aria-label={`${severityLabel}: ${title}`}>
      <SeverityIcon severity={check.severity} />
      <div className="flex-1 min-w-0">
        <p
          className={cn('text-sm leading-snug', check.severity === 'ok' && 'text-muted-foreground')}
        >
          {title}
        </p>
        {fixHint && check.severity !== 'ok' && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{fixHint}</p>
        )}
      </div>
      {check.fixDeepLink && check.severity !== 'ok' && (
        <Link
          href={check.fixDeepLink as never}
          className="shrink-0 flex items-center gap-0.5 text-xs text-primary hover:underline whitespace-nowrap"
        >
          {t('goToFix')}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </li>
  );
}

// ── Group header ──────────────────────────────────────────────────────────────

const GROUP_CLASSES: Record<CheckSeverity, string> = {
  blocker: 'bg-destructive/5 text-destructive border-destructive/20',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  ok: 'bg-muted/50 text-muted-foreground border-transparent',
};

interface GroupHeaderProps {
  severity: CheckSeverity;
  label: string;
  count: number;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}

function GroupHeader({ severity, label, count, collapsible, open, onToggle }: GroupHeaderProps) {
  const inner = (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      <SeverityIcon severity={severity} />
      <span className="text-[11px] font-bold uppercase tracking-widest flex-1">{label}</span>
      <span className="text-xs font-medium tabular-nums">{count}</span>
      {collapsible && (
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
      )}
    </div>
  );

  if (collapsible) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full text-left rounded-t-md border-b border-border',
          GROUP_CLASSES[severity],
        )}
        aria-expanded={open}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cn('rounded-t-md border-b border-border', GROUP_CLASSES[severity])}>
      {inner}
    </div>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

export interface ValidationChecklistProps {
  checks: PreflightCheck[];
  /** When true (all-pass state) the passed group is expanded by default. */
  defaultPassedOpen?: boolean;
}

export function ValidationChecklist({
  checks,
  defaultPassedOpen = false,
}: ValidationChecklistProps) {
  const t = useTranslations('Authoring.checklist');
  const blockers = checks.filter((c) => c.severity === 'blocker');
  const warnings = checks.filter((c) => c.severity === 'warning');
  const passed = checks.filter((c) => c.severity === 'ok');
  const hasIssues = blockers.length > 0 || warnings.length > 0;
  const [passedOpen, setPassedOpen] = useState(defaultPassedOpen);

  const groupedSections: Array<{
    severity: CheckSeverity;
    label: string;
    items: PreflightCheck[];
  }> = [];
  if (blockers.length > 0)
    groupedSections.push({ severity: 'blocker', label: t('blockers'), items: blockers });
  if (warnings.length > 0)
    groupedSections.push({ severity: 'warning', label: t('warnings'), items: warnings });

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {groupedSections.map(({ severity, label, items }) => (
        <div key={severity} className="border-b border-border last:border-0">
          <GroupHeader severity={severity} label={label} count={items.length} />
          <ul className="divide-y divide-border px-3" role="list">
            {items.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </div>
      ))}

      {passed.length > 0 && (
        <div>
          <GroupHeader
            severity="ok"
            label={t('passed')}
            count={passed.length}
            collapsible={hasIssues}
            open={passedOpen}
            onToggle={() => setPassedOpen((v) => !v)}
          />
          {(!hasIssues || passedOpen) && (
            <ul className="divide-y divide-border px-3" role="list">
              {passed.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
