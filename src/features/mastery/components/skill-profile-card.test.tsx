import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages as en } from '@/lib/i18n/messages';

// `getTranslations` needs a Next request context jsdom has not got; same messages,
// same rendering, through the plain translator.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: 'Mastery') =>
    createTranslator({ locale: 'en', messages: en, namespace }),
}));

vi.mock('../api/get-mastery-profile', () => ({ getMasteryProfile: vi.fn() }));

import { getMasteryProfile } from '../api/get-mastery-profile';
import { SkillProfileCard } from './skill-profile-card';
import type { MasteryProfile, MasteryUncertainCell, MasteryVerdict } from '../types';

const verdict = (over: Partial<MasteryVerdict> = {}): MasteryVerdict => ({
  skill: 'reading',
  focus: 'grammar',
  successRateEwma: 0.4,
  reason: null,
  meanStability: null,
  medianSecondsPerItem: null,
  attempts: 12,
  weightedSample: 9,
  lastAttemptAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

const uncertain = (over: Partial<MasteryUncertainCell> = {}): MasteryUncertainCell => ({
  skill: 'listening',
  focus: 'unknown',
  status: 'insufficient_data',
  attempts: 2,
  weightedSample: 1.2,
  shortfall: 6.8,
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

async function renderCard() {
  render(await SkillProfileCard({ userId: 'u1' }));
}

beforeEach(() => vi.mocked(getMasteryProfile).mockReset());

describe('SkillProfileCard', () => {
  it('sorts a verdict into "worth working on" or "going well" by the mastery bar', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({
        weakest: [verdict(), verdict({ focus: 'vocabulary', successRateEwma: 0.9 })],
      }),
    );

    await renderCard();

    expect(screen.getByText('Reading · Grammar')).toBeInTheDocument();
    expect(screen.getByText('40% right · 12 attempts')).toBeInTheDocument();
    expect(screen.getByText('Reading · Vocabulary')).toBeInTheDocument();
    expect(screen.getByText('90% right · 12 attempts')).toBeInTheDocument();
  });

  it('never puts a success rate on a cell that has no verdict', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(profile({ insufficient: [uncertain()] }));

    await renderCard();

    expect(screen.getByText('Listening · Not recorded')).toBeInTheDocument();
    expect(screen.getByText('2 attempts')).toBeInTheDocument();
    expect(screen.queryByText(/% right/)).not.toBeInTheDocument();
  });

  it('names the bar only while a cell is being held back by it', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(profile({ insufficient: [uncertain()] }));
    await renderCard();
    expect(screen.getByText(/8 typed answers/)).toBeInTheDocument();

    vi.mocked(getMasteryProfile).mockResolvedValue(profile({ weakest: [verdict()] }));
    await renderCard();
    expect(screen.getAllByText(/typed answers/)).toHaveLength(1);
  });

  it('says nothing has been measured rather than drawing empty blocks', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(profile());

    await renderCard();

    expect(
      screen.getByText('No practice has been recorded yet, so there is nothing to say.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Going well')).not.toBeInTheDocument();
  });

  it('distinguishes a failed lookup from a learner with no practice', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(null);

    await renderCard();

    expect(screen.getByText('The profile could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/nothing to say/)).not.toBeInTheDocument();
  });
});
