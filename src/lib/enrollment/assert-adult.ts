import type { ISODate } from '@/features/groups/types';

const MINOR_THRESHOLD_YEARS = 18;

/** Derived from dateOfBirth; not used in UI currently (adults-only). */
export function isMinor(dateOfBirth?: ISODate): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const age = now.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  return (hadBirthdayThisYear ? age : age - 1) < MINOR_THRESHOLD_YEARS;
}

/**
 * Single checkpoint for adult-only registration.
 * Currently a no-op — adults always pass.
 * Future: if isMinor(dateOfBirth) → require guardianAccountId before proceeding.
 */
export function assertAdult(_input: { dateOfBirth?: ISODate }): void {
  // no-op: adults-only platform right now
}
