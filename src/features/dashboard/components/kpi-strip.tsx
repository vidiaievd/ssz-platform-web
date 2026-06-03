import { TooltipProvider } from '@/components/ui/tooltip';
import type { DashboardRole, WidgetData, Kpi } from '../types';
import { kpiSetFor } from '../lib/roles';
import { KpiCard } from './kpi-card';

const KPI_LABELS: Record<Kpi['key'], string> = {
  active_students_7d: 'Active Students · 7d',
  lessons_completed_7d: 'Lessons Completed · 7d',
  pending_reviews: 'Pending Reviews',
  at_risk: 'At-Risk Students',
};

type KpiStripProps = {
  kpis: WidgetData<Kpi[]>;
  role: DashboardRole;
};

export function KpiStrip({ kpis, role }: KpiStripProps) {
  const allowedKeys = kpiSetFor(role);

  if (kpis.status === 'unavailable') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {allowedKeys.map((key) => (
          <KpiCard key={key} label={KPI_LABELS[key]} value="—" loading />
        ))}
      </div>
    );
  }

  const kpiData: Kpi[] =
    kpis.status === 'ok'
      ? kpis.data.filter((k) => allowedKeys.includes(k.key))
      : allowedKeys.map((key) => ({ key, value: 0 }));

  // Owner-only keys (at_risk) shown as locked for non-owner roles
  const ownerOnlyKeys = new Set<Kpi['key']>(['at_risk']);

  return (
    <TooltipProvider>
      <div
        role="list"
        aria-label="Key performance indicators"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {allowedKeys.map((key) => {
          const kpi = kpiData.find((k) => k.key === key);
          const isOwnerOnly = ownerOnlyKeys.has(key);
          const locked = isOwnerOnly && role !== 'owner' && role !== 'admin';

          return (
            <div key={key} role="listitem">
              <KpiCard
                label={KPI_LABELS[key]}
                value={kpi?.value ?? '—'}
                delta={kpi?.delta ?? undefined}
                trend={kpi?.trend ?? undefined}
                hint={kpi?.hint}
                spark={kpi?.spark}
                sub={kpi?.sub}
                locked={locked}
              />
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
