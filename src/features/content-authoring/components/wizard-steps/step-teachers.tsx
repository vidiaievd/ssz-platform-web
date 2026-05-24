'use client';

import { useTranslations } from 'next-intl';
import { Crown, Users, Info } from 'lucide-react';

import { useCurrentUser } from '@/features/auth/api/use-current-user';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Role matrix ────────────────────────────────────────────────────────────────

const ROLE_MATRIX = [
  { action: 'wizard.teachers.matrix.editContent', owner: true, coTeach: true, viewer: false },
  { action: 'wizard.teachers.matrix.publish', owner: true, coTeach: false, viewer: false },
  { action: 'wizard.teachers.matrix.manageTeachers', owner: true, coTeach: false, viewer: false },
  { action: 'wizard.teachers.matrix.grade', owner: true, coTeach: true, viewer: false },
  { action: 'wizard.teachers.matrix.analytics', owner: true, coTeach: true, viewer: true },
  { action: 'wizard.teachers.matrix.delete', owner: true, coTeach: false, viewer: false },
] as const;

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'text-sm',
        ok ? 'text-[var(--ssz-color-success-600)]' : 'text-[var(--ssz-text-muted)]',
      )}
      aria-label={ok ? 'Yes' : 'No'}
    >
      {ok ? '✓' : '—'}
    </span>
  );
}

// ── Step 3: Teachers ──────────────────────────────────────────────────────────

export function WizardStepTeachers() {
  const t = useTranslations('Authoring');
  const { data: user, isLoading } = useCurrentUser();

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      {/* Main column */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ssz-text-primary)] font-[Lora]">
            {t('wizard.steps.teachers')}
          </h1>
          <p className="mt-1 text-sm text-[var(--ssz-text-secondary)]">
            {t('wizard.teachers.subtitle')}
          </p>
        </div>

        {/* Owner card */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--ssz-text-primary)]">
            {t('wizard.teachers.ownerSection')}
          </p>
          <div className="flex items-center gap-3 rounded-[var(--ssz-radius-md)] border border-[var(--ssz-border-default)] bg-[var(--ssz-bg-surface)] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ssz-color-primary-100)] text-[var(--ssz-color-primary-700)]">
              <Crown className="h-5 w-5" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <p className="font-medium text-sm text-[var(--ssz-text-primary)] truncate">
                  {user?.roles?.join(', ') ?? '—'}
                </p>
              )}
            </div>
            <Badge variant="muted" className="shrink-0">
              {t('wizard.teachers.owner')}
            </Badge>
          </div>
        </div>

        {/* Co-teachers placeholder */}
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--ssz-text-primary)]">
            {t('wizard.teachers.coTeachersSection')}
          </p>
          <div className="rounded-[var(--ssz-radius-md)] border border-dashed border-[var(--ssz-border-default)] p-6 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-[var(--ssz-text-muted)]" aria-hidden />
            <p className="text-sm text-[var(--ssz-text-secondary)]">
              {t('wizard.teachers.coTeachersComingSoon')}
            </p>
            <p className="mt-1 text-xs text-[var(--ssz-text-muted)]">
              {t('wizard.teachers.coTeachersHelp')}
            </p>
          </div>
        </div>
      </div>

      {/* Role matrix */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-1.5 mb-3">
          <Info className="h-3.5 w-3.5 text-[var(--ssz-text-muted)]" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--ssz-text-muted)]">
            {t('wizard.teachers.matrixTitle')}
          </p>
        </div>

        <div className="rounded-[var(--ssz-radius-md)] border border-[var(--ssz-border-default)] overflow-hidden text-xs">
          <table className="w-full" role="table">
            <thead>
              <tr className="bg-[var(--ssz-bg-subtle)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--ssz-text-secondary)]">
                  {t('wizard.teachers.matrix.action')}
                </th>
                <th className="px-2 py-2 text-center font-medium text-[var(--ssz-text-secondary)]">
                  {t('wizard.teachers.owner')}
                </th>
                <th className="px-2 py-2 text-center font-medium text-[var(--ssz-text-secondary)]">
                  {t('wizard.teachers.coTeach')}
                </th>
                <th className="px-2 py-2 text-center font-medium text-[var(--ssz-text-secondary)]">
                  {t('wizard.teachers.viewer')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROLE_MATRIX.map((row, i) => (
                <tr
                  key={row.action}
                  className={cn(
                    'border-t border-[var(--ssz-border-default)]',
                    i % 2 === 0 ? 'bg-[var(--ssz-bg-surface)]' : 'bg-[var(--ssz-bg-subtle)]/40',
                  )}
                >
                  <td className="px-3 py-2 text-[var(--ssz-text-primary)]">
                    {t(row.action as Parameters<typeof t>[0])}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Check ok={row.owner} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Check ok={row.coTeach} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Check ok={row.viewer} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
