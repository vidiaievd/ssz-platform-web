/** Multi-state access pill used on catalog cards and the course detail panel. */
import { Check, CheckCircle, Lock, Users, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

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

const CLASSES: Record<AccessState, string> = {
  enrolled: 'bg-success-100 text-success-700',
  locked: 'bg-subtle text-(--ssz-text-muted)',
  paid: 'bg-secondary-100 text-secondary-700',
  school: 'bg-info-100 text-info-700',
  free: 'bg-primary-100 text-primary-700',
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
      className={cn(
        'inline-flex max-w-full items-center gap-1.25 overflow-hidden rounded-full px-2.25 py-0.75',
        'text-[11.5px] leading-relaxed font-bold text-ellipsis whitespace-nowrap',
        CLASSES[state],
      )}
    >
      {icon}
      {text}
    </span>
  );
}
