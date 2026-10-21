'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

import { useSaveTokenLifetimes, useTokenLifetimes } from '../api/use-token-lifetimes';
import {
  CLIENT_TYPES,
  type ClientType,
  type TokenLifetimeChange,
  type TokenLifetimes,
} from '../types/token-lifetimes';

/** Most privileged first: the rows an administrator is most likely to tighten lead. */
const ROLE_ORDER = [
  'platform_admin',
  'manager_platform',
  'school_admin',
  'teacher',
  'tutor',
  'student',
  'premium',
];

const KNOWN_ROLES = new Set(ROLE_ORDER);

type CellKey = `${string}:${ClientType}`;

const cellKey = (role: string, clientType: ClientType): CellKey => `${role}:${clientType}`;

/**
 * Refresh-token lifetimes by role and client (ADR-012), for a platform administrator.
 *
 * One number per role and client: how long a session may go unused before the user signs
 * in again. A user holding several roles gets the shortest of them. A change applies to
 * tokens issued or rotated after it — a session already open keeps its expiry until its
 * next refresh — which the screen says before anything is saved.
 *
 * Only the edited cells are sent; the service answers with every lifetime as it now stands
 * and that answer replaces the screen.
 */
export function SessionLifetimesScreen() {
  const t = useTranslations('Account.sessionLifetimes');
  const { data, isPending, isError } = useTokenLifetimes();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted) mt-1 max-w-2xl">{t('subtitle')}</p>
      </div>

      {isError ? (
        <Alert variant="error">{t('failed')}</Alert>
      ) : isPending || data === undefined ? (
        <Skeleton className="h-[420px] max-w-3xl rounded-lg" />
      ) : (
        <LifetimesForm data={data} />
      )}
    </div>
  );
}

function LifetimesForm({ data }: { data: TokenLifetimes }) {
  const t = useTranslations('Account.sessionLifetimes');
  const format = useFormatter();
  const save = useSaveTokenLifetimes();
  const unsavedChanges = useUnsavedChanges();

  // Only what was typed, keyed by cell; everything else reads from the server's answer,
  // so a refetch cannot overwrite an edit and saving or cancelling restores the answer.
  const [draft, setDraft] = useState<Partial<Record<CellKey, string>>>({});

  const saved = new Map<CellKey, number>(
    data.policies.map((p) => [cellKey(p.role, p.clientType), p.refreshLifetimeHours]),
  );
  const lastChange = data.policies.reduce<string | null>(
    (latest, p) => (p.updatedBy !== null && (latest === null || p.updatedAt > latest) ? p.updatedAt : latest),
    null,
  );

  const roles = [
    ...ROLE_ORDER.filter((role) => data.policies.some((p) => p.role === role)),
    ...[...new Set(data.policies.map((p) => p.role))].filter((role) => !KNOWN_ROLES.has(role)).sort(),
  ];

  const changes: TokenLifetimeChange[] = [];
  const errors = new Map<CellKey, string>();
  for (const [key, raw] of Object.entries(draft) as [CellKey, string][]) {
    const [role, clientType] = key.split(':') as [string, ClientType];
    const hours = Number(raw);
    if (raw.trim() === '' || !Number.isInteger(hours) || hours < data.minHours || hours > data.maxHours) {
      errors.set(key, t('bounds', { min: data.minHours, max: data.maxHours }));
      continue;
    }
    if (hours !== saved.get(key)) changes.push({ role, clientType, refreshLifetimeHours: hours });
  }

  const dirty = changes.length > 0 || errors.size > 0;
  const invalid = errors.size > 0;

  useEffect(() => {
    unsavedChanges?.setDirty(dirty);
  }, [dirty, unsavedChanges]);

  const describe = (hours: number) =>
    hours % 24 === 0 ? t('days', { n: hours / 24 }) : t('hours', { n: hours });

  const submit = () => {
    if (invalid || changes.length === 0) return;
    save.mutate(changes, {
      onSuccess: () => {
        setDraft({});
        toast.success(t('saved', { n: changes.length }));
      },
      onError: () => toast.error(t('saveFailed')),
    });
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('role')}</TableHead>
            {CLIENT_TYPES.map((clientType) => (
              <TableHead key={clientType}>{clientLabel(t, clientType)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role}>
              <TableCell className="align-top pt-4">
                <div className="font-medium">{roleLabel(t, role)}</div>
                <div className="text-xs text-(--ssz-text-muted) font-mono">{role}</div>
              </TableCell>
              {CLIENT_TYPES.map((clientType) => {
                const key = cellKey(role, clientType);
                const current = saved.get(key);
                const value = draft[key] ?? (current === undefined ? '' : String(current));
                const error = errors.get(key);
                const edited = draft[key] !== undefined && Number(draft[key]) !== current;
                const hours = Number(value);
                return (
                  <TableCell key={clientType} className="align-top">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={data.minHours}
                          max={data.maxHours}
                          step={1}
                          value={value}
                          placeholder={String(data.fallbackHours)}
                          disabled={save.isPending}
                          aria-label={`${roleLabel(t, role)} — ${clientLabel(t, clientType)}`}
                          aria-describedby={`${key}-hint`}
                          aria-invalid={error !== undefined}
                          onChange={(event) =>
                            setDraft((d) => ({ ...d, [key]: event.target.value }))
                          }
                          className={`w-28 tabular-nums ${edited ? 'border-primary' : ''}`}
                        />
                        <span className="text-xs text-(--ssz-text-muted)">{t('unit')}</span>
                      </div>
                      <span
                        id={`${key}-hint`}
                        className={`text-xs ${
                          error ? 'text-error-600 dark:text-error-400' : 'text-(--ssz-text-muted)'
                        }`}
                      >
                        {error ??
                          (current === undefined && draft[key] === undefined
                            ? t('noPolicy')
                            : Number.isInteger(hours) && hours > 0
                              ? describe(hours)
                              : '')}
                        {edited && current !== undefined && !error
                          ? ` · ${t('was', { value: describe(current) })}`
                          : ''}
                      </span>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="space-y-1.5 text-xs text-(--ssz-text-muted)">
        <p>{t('shortestWins')}</p>
        <p>{t('fallback', { value: describe(data.fallbackHours) })}</p>
        <p>
          {lastChange === null
            ? t('neverChanged')
            : t('lastChanged', {
                at: format.dateTime(new Date(lastChange), { dateStyle: 'medium', timeStyle: 'short' }),
              })}
        </p>
      </div>

      <Alert variant="info">{t('appliesFrom')}</Alert>

      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={() => setDraft({})} disabled={!dirty || save.isPending}>
          {t('cancel')}
        </Button>
        <Button onClick={submit} disabled={invalid || changes.length === 0} loading={save.isPending}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations<'Account.sessionLifetimes'>>;

function clientLabel(t: T, clientType: ClientType) {
  return clientType === 'web' ? t('client.web') : t('client.mobile');
}

function roleLabel(t: T, role: string) {
  // Explicit branches: a templated key breaks the type checker on this message set.
  switch (role) {
    case 'platform_admin':
      return t('roles.platform_admin');
    case 'manager_platform':
      return t('roles.manager_platform');
    case 'school_admin':
      return t('roles.school_admin');
    case 'teacher':
      return t('roles.teacher');
    case 'tutor':
      return t('roles.tutor');
    case 'student':
      return t('roles.student');
    case 'premium':
      return t('roles.premium');
    default:
      return role;
  }
}
