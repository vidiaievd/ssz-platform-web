import type { Entitlements, FeatureKey } from '../types';

/**
 * Whether the context may use a feature — for drawing a control or not, nothing more.
 *
 * Asks about the key, never the plan: which plan carries which key is data in
 * subscription-service, and a screen that knew "pro has AI" would drift from it the
 * first time a plan changed. Unknown rights (`null` — not read, or the service was
 * down) answer no: the button disappears, and the service that runs the feature
 * would have refused it anyway.
 */
export function can(entitlements: Entitlements | null, key: FeatureKey): boolean {
  return entitlements?.features[key]?.enabled === true;
}
