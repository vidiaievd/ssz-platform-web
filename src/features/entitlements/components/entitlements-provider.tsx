'use client';

import { createContext, useCallback, useContext } from 'react';

import { can } from '../lib/can';
import type { Entitlements, FeatureKey } from '../types';

const EntitlementsContext = createContext<Entitlements | null>(null);

/**
 * The rights of the context the shell stands in, read once by its layout on the server.
 *
 * Below this, components ask `useCan()('ai.review_draft')` and never see the plan. Outside
 * any provider every answer is no — a control that might be paid for is hidden until
 * something has said it is not.
 */
export function EntitlementsProvider({
  entitlements,
  children,
}: {
  entitlements: Entitlements | null;
  children: React.ReactNode;
}) {
  return (
    <EntitlementsContext.Provider value={entitlements}>{children}</EntitlementsContext.Provider>
  );
}

export function useCan(): (key: FeatureKey) => boolean {
  const entitlements = useContext(EntitlementsContext);
  return useCallback((key: FeatureKey) => can(entitlements, key), [entitlements]);
}
