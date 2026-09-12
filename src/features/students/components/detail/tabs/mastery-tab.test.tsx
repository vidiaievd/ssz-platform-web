import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages as en } from '@/lib/i18n/messages';
import type { StudentGrid, StudentPosition, StudentWorkContext } from '@/features/analytics/types';
import type { MasteryProfile, MasteryVerdict } from '@/features/mastery/types';
import { FOCUSES, SKILLS } from '@/lib/shared-kernel/skills/model';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: 'Analytics' | 'Mastery') =>
    createTranslator({ locale: 'en', messages: en, namespace }),
}));

vi.mock('../../../api/get-student-mastery', () => ({ getStudentMastery: vi.fn() }));

import { getStudentMastery, type StudentMastery } from '../../../api/get-student-mastery';
import { MasteryTab } from './mastery-tab';

const grid = (over: Partial<StudentGrid> = {}): StudentGrid => ({
  studentId: 's1',
  courseId: 'c1',
  minWeightedSample: 8,
  coverageUnavailable: false,
  nothingMeasured: false,
  unclassifiedAttempts: 0,
  cells: [...SKILLS].flatMap((skill) =>
    [...FOCUSES, 'unknown'].map((focus) => ({
      skill,
      focus,
      state: 'notStarted' as const,
      ewma: null,
      meanStability: null,
      attempts: 0,
      weightedSample: 0,
    })),
  ),
  ...over,
});

const verdict = (over: Partial<MasteryVerdict> = {}): MasteryVerdict => ({
  skill: 'reading',
  focus: 'grammar',
  successRateEwma: 0.38,
  reason: 'forgets',
  meanStability: 2.4,
  medianSecondsPerItem: null,
  attempts: 20,
  weightedSample: 12,
  lastAttemptAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

const profile = (over: Partial<MasteryProfile> = {}): MasteryProfile => ({
  userId: 's1',
  courseId: 'c1',
  minWeightedSample: 8,
  weakest: [],
  insufficient: [],
  ...over,
});

const position = (over: Partial<StudentPosition> = {}): StudentPosition => ({
  own: 71,
  groupMedian: 58,
  percentile: 66,
  lowerThan: 2,
  band: 'above',
  measured: 4,
  ...over,
});

const workContext = (over: Partial<StudentWorkContext> = {}): StudentWorkContext => ({
  studentId: 's1',
  courseId: 'c1',
  buckets: [
    { key: 'homework', attempts: 12, share: 60, median: 55 },
    { key: 'self_study', attempts: 8, share: 40, median: 76 },
    { key: 'classwork', attempts: 0, share: 0, median: null },
    { key: null, attempts: 0, share: 0, median: null },
  ],
  unattributed: 0,
  ...over,
});

const data = (over: Partial<StudentMastery> = {}): StudentMastery => ({
  groupId: 'g1',
  courseId: 'c1',
  grid: grid(),
  position: position(),
  workContext: workContext(),
  profile: profile(),
  ...over,
});

const draw = async (over: Partial<StudentMastery> = {}) => {
  vi.mocked(getStudentMastery).mockResolvedValue(data(over));
  render(
    await MasteryTab({
      schoolId: 'school-1',
      schoolSlug: 'nordick',
      studentId: 's1',
      groups: [{ id: 'g1', name: 'NO-A2-2026' }],
      assignHref: '/school/nordick/groups',
    }),
  );
};

beforeEach(() => vi.mocked(getStudentMastery).mockReset());

describe('MasteryTab', () => {
  it('draws no grid at all for a learner with nothing measured', async () => {
    await draw({ grid: grid({ nothingMeasured: true }) });

    expect(screen.getByText('Nothing measured for this student yet')).toBeInTheDocument();
    expect(screen.queryByText('Skill × focus')).not.toBeInTheDocument();
  });

  it('says the service is unreachable instead of drawing an empty learner', async () => {
    await draw({ grid: null });

    expect(screen.getByText(/could not reach the analytics service/i)).toBeInTheDocument();
    expect(screen.queryByText('Skill × focus')).not.toBeInTheDocument();
  });

  it('names the kind of weakness, not only its score', async () => {
    await draw({ profile: profile({ weakest: [verdict()] }) });

    expect(screen.getByText('Forgets fast')).toBeInTheDocument();
    expect(screen.getByText(/gone within days/i)).toBeInTheDocument();
    expect(screen.getByText('38%')).toBeInTheDocument();
  });

  // Two cells with the same score and opposite advice — the whole reason the label is
  // shown at all. If the label were dropped, this screen would be a colour chart.
  it('gives opposite advice to the same score', async () => {
    await draw({
      profile: profile({
        weakest: [verdict(), verdict({ focus: 'vocabulary', reason: 'never-knew' })],
      }),
    });

    expect(screen.getByText(/review closer/i)).toBeInTheDocument();
    expect(screen.getByText(/Teach it again/i)).toBeInTheDocument();
  });

  it('refuses to guess the kind of weakness when memory was never observed', async () => {
    await draw({ profile: profile({ weakest: [verdict({ reason: null })] }) });

    expect(screen.queryByText('Forgets fast')).not.toBeInTheDocument();
    expect(screen.queryByText('Never learned')).not.toBeInTheDocument();
    expect(screen.getByText(/tells forgetting apart/i)).toBeInTheDocument();
  });

  // `watch` means "listed because something had to come first", and counting it as a
  // problem would report a healthy profile as three of them.
  it('keeps "holding" out of the count of weak pairs', async () => {
    await draw({
      profile: profile({ weakest: [verdict({ reason: 'watch' }), verdict({ reason: 'watch' })] }),
    });

    const weakPairs = screen.getByText('Weak pairs').closest('div')?.parentElement;
    expect(weakPairs).toHaveTextContent('0');
  });

  it('draws no scale where the group has no median, and says why', async () => {
    await draw({ position: null });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/no scale to place this student on/i)).toBeInTheDocument();
  });

  it('places the learner against the group median when there is one', async () => {
    await draw();

    expect(screen.getByRole('img')).toHaveAccessibleName(/71%/);
    expect(screen.getByText(/2 classmates sit lower/i)).toBeInTheDocument();
  });

  it('says how many attempts it could not place rather than dropping them', async () => {
    await draw({ grid: grid({ unclassifiedAttempts: 40 }) });

    expect(screen.getByText(/40 attempts could not be placed/i)).toBeInTheDocument();
  });

  it('keeps the grid when only the profile failed', async () => {
    await draw({ profile: null });

    expect(screen.getByText('Skill × focus')).toBeInTheDocument();
    expect(screen.getByText(/could not load the profile/i)).toBeInTheDocument();
  });
});
