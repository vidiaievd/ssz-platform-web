import { COURSE_OBSOLETE, SCHOOL_NOT_ACTIVE, type SchoolLifecycleStatus } from '../types';

type Body = { error?: unknown; code?: unknown; status?: unknown; schoolStatus?: unknown; message?: unknown };

/**
 * The services answer in three shapes: organization `{ error: { code, status } }`,
 * exercise-engine `{ code, schoolStatus }`, and a plain `{ error: 'CODE' }` from learning.
 * Flattens them to `{ code, status }`; anything else is `null`.
 */
function readCode(body: unknown): { code: string; status: unknown } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Body;
  if (b.error && typeof b.error === 'object') {
    const e = b.error as Body;
    if (typeof e.code === 'string') return { code: e.code, status: e.status ?? e.schoolStatus };
  }
  if (typeof b.code === 'string') return { code: b.code, status: b.schoolStatus ?? b.status };
  if (typeof b.error === 'string') return { code: b.error, status: undefined };
  if (typeof b.message === 'string') return { code: b.message, status: undefined };
  return null;
}

function toStatus(value: unknown): SchoolLifecycleStatus | null {
  return value === 'suspended' || value === 'closed' || value === 'purged' || value === 'active' ? value : null;
}

/** `suspended` / `closed` when `body` is the "school is read only" refusal, else `null`. */
export function schoolNotActiveStatus(body: unknown): 'suspended' | 'closed' | null {
  const parsed = readCode(body);
  if (!parsed || parsed.code !== SCHOOL_NOT_ACTIVE) return null;
  // A refusal that does not say why still means "not open"; `suspended` is the milder wording.
  const status = toStatus(parsed.status);
  return status === 'closed' || status === 'purged' ? 'closed' : 'suspended';
}

export function isCourseObsolete(body: unknown): boolean {
  return readCode(body)?.code === COURSE_OBSOLETE;
}

/** Translation key under `SchoolLifecycle.errors` for a refusal body, or `null` if it is neither. */
export function lifecycleErrorKey(body: unknown): 'schoolSuspended' | 'schoolClosed' | 'courseObsolete' | null {
  const school = schoolNotActiveStatus(body);
  if (school) return school === 'closed' ? 'schoolClosed' : 'schoolSuspended';
  return isCourseObsolete(body) ? 'courseObsolete' : null;
}

/** Same, for an AppError / serialized error whose `details` carry the upstream body. */
export function lifecycleErrorKeyOf(error: unknown): ReturnType<typeof lifecycleErrorKey> {
  return lifecycleErrorKey((error as { details?: unknown } | null | undefined)?.details);
}
