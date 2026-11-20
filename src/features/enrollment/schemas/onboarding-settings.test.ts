import { describe, expect, it } from 'vitest';

import { onboardingSettingsSchema } from './onboarding-settings';

const base = {
  placement: { mode: 'platform', reusePlatformResult: true },
  interview: { required: true, autoPlaceByScore: false },
  availability: { collect: true },
  ageBands: { values: [], collect: false },
  approval: { mode: 'manual' },
};

const withMaxAge = (value: unknown) => ({ ...base, placement: { ...base.placement, maxResultAgeDays: value } });

describe('onboardingSettingsSchema — max result age (plan 90, live check, session 13)', () => {
  // An empty number field reads as NaN and a never-set value arrives as null; the form used to refuse
  // to submit without saying anything.
  it.each([[Number.NaN], [null], [''], [undefined]])('treats %s as "not set"', (value) => {
    const parsed = onboardingSettingsSchema.safeParse(withMaxAge(value));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.placement.maxResultAgeDays).toBeUndefined();
  });

  it('keeps a whole number of days', () => {
    expect(onboardingSettingsSchema.parse(withMaxAge(30)).placement.maxResultAgeDays).toBe(30);
  });

  it('still refuses zero and fractions', () => {
    expect(onboardingSettingsSchema.safeParse(withMaxAge(0)).success).toBe(false);
    expect(onboardingSettingsSchema.safeParse(withMaxAge(1.5)).success).toBe(false);
  });
});
