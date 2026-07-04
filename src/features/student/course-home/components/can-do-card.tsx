import { Target, CheckCircle2, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CanDoItem, UnitSummary } from '@/features/learning';

/* ── Relative time ───────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/* ── CEFR badge ──────────────────────────────────────────────────── */

function CefrBadge({ level }: { level?: string }) {
  if (!level) return null;
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
      style={{
        background: 'var(--ssz-color-primary-100)',
        color: 'var(--ssz-color-primary-700)',
      }}
    >
      {level}
    </span>
  );
}

/* ── CanDoCard ───────────────────────────────────────────────────── */

export interface CanDoCardProps {
  items: CanDoItem[];
  units: UnitSummary[];
}

export function CanDoCard({ items, units }: CanDoCardProps) {
  const t = useTranslations('Learning.courseHome.canDoCard');

  const unlocked = items.filter((i) => i.state === 'unlocked');
  const achieved = unlocked.length;
  const total = items.length;
  const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;

  /* Last 2 unlocked items sorted by recency */
  const recent = [...unlocked]
    .sort((a, b) =>
      (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''),
    )
    .slice(0, 2);

  /* First non-unlocked item as the next goal */
  const next = items.find((i) => i.state !== 'unlocked');

  /* Unit position lookup */
  const unitPositionById = new Map(units.map((u) => [u.id, u.position]));

  if (total === 0) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--ssz-bg-surface)', boxShadow: 'var(--ssz-shadow-sm)' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Target size={18} style={{ color: 'var(--ssz-color-primary-500)' }} aria-hidden="true" />
          <p className="text-sm font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
            {t('title')}
          </p>
        </div>
        <p className="text-xs" style={{ color: 'var(--ssz-text-muted)' }}>
          {t('noItems')}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--ssz-bg-surface)', boxShadow: 'var(--ssz-shadow-sm)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Target size={18} style={{ color: 'var(--ssz-color-primary-500)' }} aria-hidden="true" />
        <p className="text-sm font-semibold" style={{ color: 'var(--ssz-text-primary)' }}>
          {t('title')}
        </p>
      </div>

      {/* Progress count + bar */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: 30, color: 'var(--ssz-text-primary)' }}
        >
          {achieved}
        </span>
        <span className="text-sm" style={{ color: 'var(--ssz-text-muted)' }}>
          / {t('goals', { total })}
        </span>
      </div>
      <div
        className="mt-2 overflow-hidden rounded-full"
        style={{ height: 5, background: 'var(--ssz-bg-muted)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${achieved} of ${total} can-do goals achieved`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: 'var(--ssz-color-success-500)',
          }}
        />
      </div>

      {/* Recently unlocked */}
      {recent.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ssz-text-muted)' }}>
            {t('recentTitle')}
          </p>
          <ul className="space-y-2">
            {recent.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0"
                  style={{ color: 'var(--ssz-color-success-500)' }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug" style={{ color: 'var(--ssz-text-primary)' }}>
                    {item.descriptor}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <CefrBadge level={item.cefrLevel} />
                    {item.unlockedAt && (
                      <span className="text-[11px]" style={{ color: 'var(--ssz-text-muted)' }}>
                        {relativeTime(item.unlockedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next goal */}
      {next && (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl p-3"
          style={{ background: 'var(--ssz-bg-subtle)' }}
        >
          <ChevronRight
            size={16}
            className="mt-0.5 shrink-0"
            style={{ color: 'var(--ssz-color-primary-500)' }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ssz-text-muted)' }}>
              {t('nextTitle')}
            </p>
            <p className="text-xs leading-snug" style={{ color: 'var(--ssz-text-primary)' }}>
              {next.descriptor}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <CefrBadge level={next.cefrLevel} />
              {next.moduleId && unitPositionById.has(next.moduleId) && (
                <span className="text-[11px]" style={{ color: 'var(--ssz-text-muted)' }}>
                  {t('inUnit', { n: unitPositionById.get(next.moduleId) ?? '' })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
