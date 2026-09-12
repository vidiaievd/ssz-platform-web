import 'server-only';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { FOCUSES, SKILLS } from '@/lib/shared-kernel/skills/model';

import type { MasteryProfile } from '../types';

const Skill = z.enum([...SKILLS, 'unknown']);
const Focus = z.enum([...FOCUSES, 'unknown']);

const RawVerdict = z.object({
  skill: Skill,
  focus: Focus,
  successRateEwma: z.number(),
  reason: z.enum(['forgets', 'never-knew', 'watch']).nullable().default(null),
  meanStability: z.number().nullable(),
  medianSecondsPerItem: z.number().nullable(),
  attempts: z.number(),
  weightedSample: z.number(),
  lastAttemptAt: z.string(),
});

const RawUncertain = z.object({
  skill: Skill,
  focus: Focus,
  status: z.literal('insufficient_data'),
  attempts: z.number(),
  weightedSample: z.number(),
  shortfall: z.number(),
});

/**
 * Validated rather than trusted, for the reason the next-class card is: this renders
 * a claim about a person, and a shape change upstream must degrade to "we cannot say"
 * instead of drawing an empty profile, which is a different and wrong claim (§3.10).
 */
const RawProfile = z.object({
  userId: z.string(),
  courseId: z.string().nullable(),
  minWeightedSample: z.number(),
  weakest: z.array(RawVerdict),
  insufficient: z.array(RawUncertain),
});

/**
 * What analytics knows about this learner — plan 55 §5.2, read for §6.
 *
 * Called directly rather than through the gateway: `/internal/*` is behind
 * `InternalAuthGuard` and deliberately unrouted by nginx, because the answer is about
 * a named learner. Both callers are server components that have already established
 * who may look — the teacher through their school role, the learner by being
 * themselves — so the authorisation lives at the call sites, not here.
 *
 * `null` means "we could not ask", and it is not the same as an empty profile. A
 * caller must render silence for `null` and "nothing measured yet" for a profile with
 * no cells; collapsing the two would turn a broken service into a statement about
 * the learner.
 */
export async function getMasteryProfile(
  userId: string,
  options: { courseId?: string; limit?: number } = {},
): Promise<MasteryProfile | null> {
  if (!env.ANALYTICS_SERVICE_INTERNAL_URL || !env.INTERNAL_SERVICE_TOKEN) return null;

  try {
    const raw = await serverFetch({
      service: 'analytics',
      path: `/internal/mastery/${userId}`,
      directBaseUrl: env.ANALYTICS_SERVICE_INTERNAL_URL,
      query: { courseId: options.courseId, limit: options.limit },
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN },
      anonymous: true,
    });

    const parsed = RawProfile.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
