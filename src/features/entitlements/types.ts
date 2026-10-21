/**
 * Feature keys a plan can switch on, as subscription-service names them (plan 78 §2).
 * The catalogue lives in the service; this list is only what the web asks about.
 */
export type FeatureKey =
  | 'ai.review_draft'
  | 'ai.review_direct'
  | 'ai.student_assist'
  | 'ai.practice'
  | 'ai.authoring';

export interface FeatureEntitlement {
  enabled: boolean;
  /** Credits per credit period; null = unmetered. A decimal string, never a float. */
  monthlyCredits: string | null;
  limits: Record<string, number>;
}

/**
 * What the current context — a workspace, or the learner on their own — may use.
 *
 * Only the parts the UI reads are typed here; the answer of `/subscriptions/me` carries
 * more (plan, subscription, period), and those stay with the service until a screen
 * needs them.
 */
export interface Entitlements {
  account: { type: 'workspace' | 'user'; externalId: string };
  /** A key absent here is not available. */
  features: Partial<Record<string, FeatureEntitlement>>;
  /** When time alone changes this answer. ISO 8601. */
  validUntil: string;
  version: number;
}
