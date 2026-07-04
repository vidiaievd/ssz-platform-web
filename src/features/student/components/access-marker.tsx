/** Multi-state access pill used on catalog cards and the course detail panel. */
import { Check, CheckCircle, Lock, Users, Zap } from 'lucide-react';

export type AccessState = 'enrolled' | 'locked' | 'paid' | 'school' | 'free';

/** Derive the AccessState from a container's accessTier + enrollment flag. */
export function resolveAccessState(
  accessTier: string,
  isEnrolled = false,
): AccessState {
  if (isEnrolled) return 'enrolled';
  switch (accessTier) {
    case 'public_free':           return 'free';
    case 'public_paid':           return 'paid';
    case 'free_within_school':
    case 'assigned_only':         return 'school';
    case 'entitlement_required':  return 'locked';
    default:                      return 'free';
  }
}

interface Labels {
  enrolled: string;
  locked: string;
  free: string;
}

export interface AccessMarkerProps {
  state: AccessState;
  /** School name — shown for the "school" state. */
  schoolName?: string | null;
  /** Price in EUR — shown for the "paid" state. */
  price?: number | null;
  labels: Labels;
}

const BG: Record<AccessState, string> = {
  enrolled: 'var(--ssz-color-success-100)',
  locked:   'var(--ssz-bg-subtle)',
  paid:     'var(--ssz-color-secondary-100)',
  school:   'var(--ssz-color-info-100)',
  free:     'var(--ssz-color-primary-100)',
};
const CLR: Record<AccessState, string> = {
  enrolled: 'var(--ssz-color-success-700)',
  locked:   'var(--ssz-text-muted)',
  paid:     'var(--ssz-color-secondary-700)',
  school:   'var(--ssz-color-info-700)',
  free:     'var(--ssz-color-primary-700)',
};

export function AccessMarker({ state, schoolName, price, labels }: AccessMarkerProps) {
  let icon: React.ReactNode;
  let text: string;

  switch (state) {
    case 'enrolled':
      icon = <CheckCircle size={13} aria-hidden="true" />;
      text = labels.enrolled;
      break;
    case 'locked':
      icon = <Lock size={12} aria-hidden="true" />;
      text = labels.locked;
      break;
    case 'paid':
      icon = <Zap size={12} aria-hidden="true" />;
      text = price != null ? `€${price}` : '€—';
      break;
    case 'school':
      icon = <Users size={12} aria-hidden="true" />;
      text = schoolName ?? '—';
      break;
    case 'free':
    default:
      icon = <Check size={12} aria-hidden="true" />;
      text = labels.free;
      break;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11.5,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 999,
        background: BG[state],
        color: CLR[state],
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      {icon}
      {text}
    </span>
  );
}
