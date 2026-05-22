import type { Profile } from '../types';

type CompletenessField = {
  key: string;
  weight: number;
  filled: (p: Profile) => boolean;
};

const FIELDS: CompletenessField[] = [
  { key: 'displayName', weight: 25, filled: (p) => p.displayName.trim().length > 0 },
  { key: 'avatarUrl', weight: 20, filled: (p) => p.avatarUrl !== null },
  { key: 'bio', weight: 20, filled: (p) => p.bio !== null && p.bio.trim().length > 0 },
  { key: 'timezone', weight: 15, filled: (p) => p.timezone.length > 0 && p.timezone !== 'UTC' },
  { key: 'instructionLocales', weight: 10, filled: (p) => p.instructionLocales.length > 0 },
  { key: 'contactEmail', weight: 5, filled: (p) => p.contactEmail !== null },
  { key: 'contactPhone', weight: 5, filled: (p) => p.contactPhone !== null },
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
