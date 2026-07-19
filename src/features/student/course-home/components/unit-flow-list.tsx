import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { UnitSummary } from '@/features/learning';

/* ── Status tile ─────────────────────────────────────────────────── */

function StatusTile({ n, status }: { n: number; status: UnitSummary['status'] }) {
  const size = 40;
  if (status === 'done') {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: 'var(--ssz-color-success-100)',
          color: 'var(--ssz-color-success-700)',
        }}
        aria-hidden="true"
      >
        <Check size={18} strokeWidth={2.5} />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{
          width: size,
          height: size,
          background: 'var(--ssz-color-primary-500)',
          fontSize: 15,
        }}
        aria-hidden="true"
      >
        {n}
      </div>
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        background: 'var(--ssz-bg-muted)',
        color: 'var(--ssz-text-muted)',
        fontSize: 15,
      }}
      aria-hidden="true"
    >
      {n}
    </div>
  );
}

/* ── Status badge ────────────────────────────────────────────────── */

function StatusBadge({
  status,
  label,
}: {
  status: UnitSummary['status'];
  label: string;
}) {
  const colorMap = {
    done: {
      bg: 'var(--ssz-color-success-100)',
      color: 'var(--ssz-color-success-700)',
    },
    active: {
      bg: 'var(--ssz-color-primary-100)',
      color: 'var(--ssz-color-primary-700)',
    },
    locked: {
      bg: 'var(--ssz-bg-muted)',
      color: 'var(--ssz-text-muted)',
    },
  } as const;

  const { bg, color } = colorMap[status];

  return (
    <span
      className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

/* ── Active unit progress bar ────────────────────────────────────── */

function ActiveUnitProgress({
  completedLessons,
  totalLessons,
}: {
  completedLessons: number;
  totalLessons: number;
}) {
  const pct = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  return (
    <div
      className="mt-3 overflow-hidden rounded-full"
      style={{ height: 4, background: 'var(--ssz-bg-muted)' }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: 'var(--ssz-color-primary-500)',
        }}
      />
    </div>
  );
}

/* ── Unit row ────────────────────────────────────────────────────── */

interface UnitRowProps {
  unit: UnitSummary;
  unitHref: string;
}

function UnitRow({ unit, unitHref }: UnitRowProps) {
  const t = useTranslations('Learning.courseHome.unitFlowList');

  const statusLabel = {
    done: t('statusDone'),
    active: t('statusActive'),
    locked: t('statusLocked'),
  }[unit.status];

  return (
    <li
      className="relative flex items-start gap-4 py-4"
      aria-label={`Unit ${unit.position}: ${unit.title}, ${statusLabel}`}
    >
      {/* Vertical track line */}
      <div
        className="absolute left-5 top-0 h-full w-px"
        style={{ background: 'var(--ssz-border-default)' }}
        aria-hidden="true"
      />

      <StatusTile n={unit.position} status={unit.status} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {unit.status === 'locked' ? (
              <p
                className="truncate font-semibold leading-tight"
                style={{ color: 'var(--ssz-text-muted)', fontSize: 15 }}
              >
                {unit.title}
              </p>
            ) : (
              <a
                href={unitHref}
                className="truncate font-semibold leading-tight hover:underline"
                style={{ color: 'var(--ssz-text-primary)', fontSize: 15 }}
              >
                {unit.title}
              </a>
            )}
            {unit.totalLessons > 0 && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--ssz-text-muted)' }}>
                {t('lessons', {
                  done: unit.completedLessons,
                  total: unit.totalLessons,
                })}
              </p>
            )}
          </div>
          <StatusBadge status={unit.status} label={statusLabel} />
        </div>

        {unit.status === 'active' && (
          <ActiveUnitProgress
            completedLessons={unit.completedLessons}
            totalLessons={unit.totalLessons}
          />
        )}
      </div>
    </li>
  );
}

/* ── UnitFlowList ────────────────────────────────────────────────── */

export interface UnitFlowListProps {
  units: UnitSummary[];
  courseId: string;
  locale: string;
}

export function UnitFlowList({ units, courseId, locale }: UnitFlowListProps) {
  if (units.length === 0) return null;

  return (
    <ul
      className="divide-y"
      style={{ borderColor: 'var(--ssz-border-default)' }}
      aria-label="Course units"
    >
      {units.map((unit) => (
        <UnitRow
          key={unit.id}
          unit={unit}
          unitHref={`/${locale}/student/courses/${courseId}/${unit.id}`}
        />
      ))}
    </ul>
  );
}
