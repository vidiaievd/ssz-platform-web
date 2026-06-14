import type { Profile } from '../types';

type CompletenessField = {
  key: string;
  weight: number;
  filled: (p: Profile) => boolean;
};

const FIELDS: CompletenessField[] = [
  { key: 'displayName', weight: 25, filled: (p) => !!p.displayName?.trim() },
  { key: 'avatarUrl', weight: 20, filled: (p) => p.avatarUrl != null },
  { key: 'bio', weight: 20, filled: (p) => !!p.bio?.trim() },
  { key: 'timezone', weight: 15, filled: (p) => !!p.timezone && p.timezone !== 'UTC' },
  { key: 'instructionLocales', weight: 10, filled: (p) => (p.instructionLocales?.length ?? 0) > 0 },
  { key: 'contactEmail', weight: 5, filled: (p) => p.contactEmail != null },
  { key: 'contactPhone', weight: 5, filled: (p) => p.contactPhone != null },
];

export type CompletenessResult = {
  /** 0–100 */
  score: number;
  missingFields: string[];
};

export function calculateCompleteness(profile: Profile): CompletenessResult {
  let earned = 0;
  const missingFields: string[] = [];

  for (const field of FIELDS) {
    if (field.filled(profile)) {
      earned += field.weight;
    } else {
      missingFields.push(field.key);
    }
  }

  return { score: earned, missingFields };
}
