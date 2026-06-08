import { getTranslations } from 'next-intl/server';

import { ProgressBar } from '@/components/ui/progress';
import { StatusChip } from './status-chip';
import type { StudentDetail } from '@/features/students/types';

type Props = {
  student: StudentDetail;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return '—';
  return formatDate(iso);
}

export async function StudentProgressPanel({ student }: Props) {
  const t = await getTranslations('Students');
  const pct = Math.round(student.progress * 100);

  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
      {/* Big progress display */}
      <div>
        <h2 className="text-base font-semibold mb-3">{t('detail.progress')}</h2>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold tabular-nums leading-none">{pct}%</span>
        </div>
        <ProgressBar
          value={pct}
          className="mt-3"
          aria-label={t('detail.progressAriaLabel', { pct })}
          aria-valuetext={`${pct}%`}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('detail.lastActive')}: {formatLastSeen(student.lastSeen)}
        </p>
      </div>

      {/* Detail rows */}
      <div className="space-y-3 border-t pt-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('detail.details')}
        </h2>

        <dl className="space-y-2">
          <DetailRow label={t('detail.language')} value={student.lang.toUpperCase()} />
          <DetailRow label={t('detail.level')} value={student.level} />
          <DetailRow
            label={t('detail.status')}
            value={<StatusChip status={student.status} />}
          />
          <DetailRow
            label={t('detail.groupsCount')}
            value={String(student.groups.length)}
          />
          <DetailRow
            label={t('detail.enrolledDate')}
            value={formatDate(student.enrolledAt)}
          />
        </dl>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-right">{value}</dd>
    </div>
  );
}
