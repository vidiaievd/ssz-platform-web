import { useTranslations } from 'next-intl';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { DashboardRole, WidgetData, Kpi } from '../types';
import { kpiSetFor } from '../lib/roles';
import { KpiCard } from './kpi-card';

/** Keys whose analytics hint carries numbers (`hintValues`) we can word in the reader's language. */
const HINT_KEYS = new Set<Kpi['key']>(['active_students_7d', 'lessons_completed_7d', 'at_risk']);

type KpiStripProps = {
  kpis: WidgetData<Kpi[]>;
  role: DashboardRole;
};

export function KpiStrip({ kpis, role }: KpiStripProps) {
  const t = useTranslations('School.dashboard.kpis');
  const allowedKeys = kpiSetFor(role);
  const label = (key: Kpi['key']) => t(`labels.${key}`);
  // The service writes its hint in English; with the numbers beside it we say it ourselves.
  const hintOf = (kpi: Kpi | undefined) =>
    kpi?.hintValues && HINT_KEYS.has(kpi.key)
      ? t(`hints.${kpi.key as 'active_students_7d'}`, kpi.hintValues as never)
      : kpi?.hint;

  if (kpis.status === 'unavailable') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* No data, not "still loading": a skeleton here never ended. */}
        {allowedKeys.map((key) => (
          <KpiCard key={key} label={label(key)} value="—" />
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
        aria-label={t('label')}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {allowedKeys.map((key) => {
          const kpi = kpiData.find((k) => k.key === key);
          const isOwnerOnly = ownerOnlyKeys.has(key);
          const locked = isOwnerOnly && role !== 'owner' && role !== 'admin';

          return (
            <div key={key} role="listitem">
              <KpiCard
                label={label(key)}
                value={kpi?.value ?? '—'}
                delta={kpi?.delta ?? undefined}
                trend={kpi?.trend ?? undefined}
                hint={hintOf(kpi)}
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
