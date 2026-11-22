/** Where a school stands in its lifecycle (plan 90, phase 5). Mirrors organization-service. */
export type SchoolLifecycleStatus = 'active' | 'suspended' | 'closed' | 'purged';

/** The three fields every school read carries. All optional: an older service sends none. */
export interface SchoolLifecycleFields {
  status?: SchoolLifecycleStatus;
  /** When a suspended school closes by itself (ISO). */
  closesAt?: string | null;
  /** When a closed school is purged (ISO). */
  purgeAt?: string | null;
}

/** Whether a course is still looked after (content-service `maintenanceStatus`). */
export type MaintenanceStatus = 'maintained' | 'unmaintained' | 'obsolete';

export const SCHOOL_NOT_ACTIVE = 'SCHOOL_NOT_ACTIVE';
/** Browser event an attempt request raises when its school is read only; one notice words it. */
export const SCHOOL_NOT_ACTIVE_EVENT = 'ssz:school-not-active';

/** How long a refusal still explains a failed start: the runner's error body mounts right after it. */
const REFUSAL_MEMORY_MS = 10_000;
let lastRefusal: { status: 'suspended' | 'closed'; at: number } | null = null;

/** Remembers a SCHOOL_NOT_ACTIVE refusal, so an error body that mounts afterwards can say why. */
export function rememberSchoolRefusal(status: unknown): void {
  lastRefusal = { status: status === 'closed' ? 'closed' : 'suspended', at: Date.now() };
}

/** The school refusal of the last few seconds, or null. */
export function recentSchoolRefusal(): 'suspended' | 'closed' | null {
  return lastRefusal && Date.now() - lastRefusal.at < REFUSAL_MEMORY_MS ? lastRefusal.status : null;
}

export const COURSE_OBSOLETE = 'COURSE_OBSOLETE';
