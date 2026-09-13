import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages as en } from '@/lib/i18n/messages';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: 'Mastery') =>
    createTranslator({ locale: 'en', messages: en, namespace }),
}));

vi.mock('@/features/mastery/api/get-mastery-profile', () => ({ getMasteryProfile: vi.fn() }));

import { getMasteryProfile } from '@/features/mastery/api/get-mastery-profile';
import type {
  MasteryProfile,
  MasteryUncertainCell,
  MasteryVerdict,
} from '@/features/mastery/types';

import { WorthALook } from './worth-a-look';

const verdict = (over: Partial<MasteryVerdict> = {}): MasteryVerdict => ({
  skill: 'reading',
  focus: 'grammar',
  successRateEwma: 0.42,
  reason: 'forgets',
  meanStability: 3.2,
  medianSecondsPerItem: null,
  attempts: 14,
  weightedSample: 11,
  lastAttemptAt: '2026-09-10T10:00:00.000Z',
  ...over,
});

const thin = (over: Partial<MasteryUncertainCell> = {}): MasteryUncertainCell => ({
  skill: 'written',
  focus: 'vocabulary',
  status: 'insufficient_data',
  attempts: 2,
  weightedSample: 1.5,
  shortfall: 6.5,
  ...over,
});

const profile = (over: Partial<MasteryProfile> = {}): MasteryProfile => ({
  userId: 'u1',
  courseId: null,
  minWeightedSample: 8,
  weakest: [],
  insufficient: [],
  ...over,
});

beforeEach(() => vi.mocked(getMasteryProfile).mockReset());

describe('WorthALook', () => {
  it('says why a pair is listed, and never how badly', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(profile({ weakest: [verdict()] }));

    render(await WorthALook({ userId: 'u1' }));

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByText(/fades within days/)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('tells forgetting apart from never having learnt it', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({ weakest: [verdict({ reason: 'never-knew' })] }),
    );

    render(await WorthALook({ userId: 'u1' }));

    expect(screen.getByText(/the rule itself that needs another look/)).toBeInTheDocument();
  });

  it('words a thin cell as an action rather than as a shortfall', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(profile({ insufficient: [thin()] }));

    render(await WorthALook({ userId: 'u1' }));

    expect(screen.getByText(/three more and this turns into real feedback/)).toBeInTheDocument();
    // The bar itself is the teacher's business, and the learner is never shown a
    // fraction of it.
    expect(screen.queryByText(/1.5/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/8/)).not.toBeInTheDocument();
  });

  it('puts the weak pairs first and fills at most three rows', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({
        weakest: [
          verdict({ focus: 'grammar' }),
          verdict({ skill: 'written', focus: 'vocabulary' }),
          verdict({ skill: 'listening', focus: 'pragmatics' }),
        ],
        insufficient: [thin({ skill: 'spoken' })],
      }),
    );

    render(await WorthALook({ userId: 'u1' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText(/three more and this turns/)).not.toBeInTheDocument();
  });

  it('renders nothing at all rather than an encouraging placeholder', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(profile());
    expect(await WorthALook({ userId: 'u1' })).toBeNull();

    // And the same when the profile could not be fetched: silence, not a claim.
    vi.mocked(getMasteryProfile).mockResolvedValue(null);
    expect(await WorthALook({ userId: 'u1' })).toBeNull();
  });

  it('never prints the unnameable pair at the learner', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({ weakest: [verdict({ skill: 'unknown', focus: 'unknown' })] }),
    );

    expect(await WorthALook({ userId: 'u1' })).toBeNull();
  });
});
