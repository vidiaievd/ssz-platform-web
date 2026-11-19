'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import type { SchoolLifecycleStatus } from '../types';

const SchoolStatusContext = createContext<SchoolLifecycleStatus | undefined>(undefined);

/**
 * The workspace's lifecycle status for the controls under it (plan 90, live check, block 9).
 * Like `useCan()`, it only decides which controls are drawn — the services refuse a write to a
 * school that is not `active` regardless.
 */
export function SchoolWritableProvider({
  status,
  children,
}: {
  status: SchoolLifecycleStatus | undefined;
  children: ReactNode;
}) {
  return <SchoolStatusContext.Provider value={status}>{children}</SchoolStatusContext.Provider>;
}

/** False in a suspended or closed workspace. Outside a workspace, or status unknown: true. */
export function useSchoolWritable(): boolean {
  const status = useContext(SchoolStatusContext);
  return !status || status === 'active';
}

/** Renders its children only while the workspace takes changes. */
export function WritableOnly({ children }: { children: ReactNode }) {
  return useSchoolWritable() ? <>{children}</> : null;
}

/**
 * Why a form is read only. In a suspended or closed workspace that is the school's status, not
 * the viewer's role — an owner must not read "only owners can change this" (plan 90, block 9).
 */
export function ReadOnlyReason({ children }: { children: ReactNode }) {
  const t = useTranslations('SchoolLifecycle.readOnly');
  return <>{useSchoolWritable() ? children : t('body')}</>;
}
