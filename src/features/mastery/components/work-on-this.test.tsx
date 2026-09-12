import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages as en } from '@/lib/i18n/messages';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: 'Mastery') =>
    createTranslator({ locale: 'en', messages: en, namespace }),
}));

vi.mock('../api/get-mastery-profile', () => ({ getMasteryProfile: vi.fn() }));

import { getMasteryProfile } from '../api/get-mastery-profile';
import { WorkOnThis } from './work-on-this';
import type { MasteryProfile, MasteryVerdict } from '../types';

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

const profile = (over: Partial<MasteryProfile> = {}): MasteryProfile => ({
  userId: 'u1',
  courseId: null,
  minWeightedSample: 8,
  weakest: [],
  insufficient: [],
  ...over,
});

const renderBlock = async () => WorkOnThis({ userId: 'u1' });

beforeEach(() => vi.mocked(getMasteryProfile).mockReset());

describe('WorkOnThis', () => {
  it('names the skill, with no score attached to it', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(profile({ weakest: [verdict()] }));

    render(await renderBlock());

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/attempt/)).not.toBeInTheDocument();
  });

  it('falls back to the subject when the channel was never recorded', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({ weakest: [verdict({ skill: 'unknown', focus: 'vocabulary' })] }),
    );

    render(await renderBlock());

    expect(screen.getByText('Vocabulary')).toBeInTheDocument();
    expect(screen.queryByText('Not recorded')).not.toBeInTheDocument();
  });

  it('shows at most three cells', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({
        weakest: [
          verdict({ focus: 'grammar' }),
          verdict({ focus: 'vocabulary' }),
          verdict({ focus: 'orthography' }),
          verdict({ focus: 'pragmatics' }),
        ],
      }),
    );

    render(await renderBlock());

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders nothing when everything is going well', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({ weakest: [verdict({ successRateEwma: 0.95 })] }),
    );

    expect(await renderBlock()).toBeNull();
  });

  it('never tells the learner that nothing is known about them', async () => {
    // §6.2: `insufficient_data` is a finding for the teacher, not feedback for the learner.
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({
        insufficient: [
          {
            skill: 'listening',
            focus: 'unknown',
            status: 'insufficient_data',
            attempts: 2,
            weightedSample: 1,
            shortfall: 7,
          },
        ],
      }),
    );

    expect(await renderBlock()).toBeNull();
  });

  it('renders nothing when the profile could not be loaded', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(null);

    expect(await renderBlock()).toBeNull();
  });

  it('drops a cell with neither axis recorded rather than naming it', async () => {
    vi.mocked(getMasteryProfile).mockResolvedValue(
      profile({ weakest: [verdict({ skill: 'unknown', focus: 'unknown' })] }),
    );

    expect(await renderBlock()).toBeNull();
  });
});
