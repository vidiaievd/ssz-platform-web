export type { Entitlements, FeatureEntitlement, FeatureKey } from './types';
export { can } from './lib/can';
export { EntitlementsProvider, useCan } from './components/entitlements-provider';
// getEntitlements is server-only — import directly from './api/get-entitlements' in layouts
