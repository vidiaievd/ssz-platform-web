import type { Profile } from '../types';

type CompletenessField = {
  key: string;
  /** Base weight before normalization */
  weight: number;
  /** Which facet presence this field depends on; undefined = always applies */
  facet?: 'teaching' | 'tutor' | 'learner';
  filled: (p: Profile, extra?: FacetExtra) => boolean;
};

export type FacetExtra = {
  hasTeaching: boolean;
  hasTutor: boolean;
  hasLearner: boolean;
  teachingLanguagesCount: number;
  targetLanguagesCount: number;
  hourlyRate: number | null;
  currency: string | null;
};

const ALL_FIELDS: CompletenessField[] = [
  { key: 'displayName', weight: 20, filled: (p) => !!p.displayName?.trim() },
  { key: 'avatarUrl', weight: 15, filled: (p) => p.avatarUrl != null },
  { key: 'bio', weight: 15, filled: (p) => !!p.bio?.trim() },
  { key: 'timezone', weight: 10, filled: (p) => !!p.timezone && p.timezone !== 'UTC' },
  { key: 'contactEmail', weight: 5, filled: (p) => p.contactEmail != null },
  { key: 'teachingLanguages', weight: 20, facet: 'teaching', filled: (_p, e) => (e?.teachingLanguagesCount ?? 0) >= 1 },
  { key: 'hourlyRateCurrency', weight: 15, facet: 'tutor', filled: (_p, e) => e?.hourlyRate != null && e?.currency != null },
  { key: 'targetLanguages', weight: 20, facet: 'learner', filled: (_p, e) => (e?.targetLanguagesCount ?? 0) >= 1 },
];

export type CompletenessResult = {
  /** 0–100 */
  score: number;
  /** Keys of missing fields, priority-sorted: required → public-profile → optional */
  missingFields: string[];
};

export function calculateCompleteness(profile: Profile, extra?: FacetExtra): CompletenessResult {
  const applicable = ALL_FIELDS.filter((f) => {
    if (!f.facet) return true;
    if (f.facet === 'teaching') return extra?.hasTeaching ?? false;
    if (f.facet === 'tutor') return extra?.hasTutor ?? false;
    if (f.facet === 'learner') return extra?.hasLearner ?? false;
    return false;
  });

  const totalWeight = applicable.reduce((sum, f) => sum + f.weight, 0);
  let earned = 0;
  const missingFields: string[] = [];

  for (const field of applicable) {
    if (field.filled(profile, extra)) {
      earned += field.weight;
    } else {
      missingFields.push(field.key);
    }
  }

  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 100;

  return { score, missingFields };
}
