import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages as en } from '@/lib/i18n/messages';
import type {
  ModalityGap,
  ModalityGapRow,
  StudentGrid,
  StudentPosition,
  StudentWorkContext,
} from '@/features/analytics/types';
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

const gap = (over: Partial<ModalityGap> = {}): ModalityGap => ({
  studentId: 's1',
  courseId: 'c1',
  minAttempts: 3,
  thresholds: { strong: 0.8, failing: 0.6 },
  namesAvailable: true,
  summary: {
    addressedAtoms: 15,
    judged: 9,
    insufficient: 6,
    recognitionOnly: 3,
    productionUntried: 0,
    productionFailing: 1,
    recallFailing: 0,
    even: 5,
    observations: 42,
    contextObservations: 0,
    cardReviews: 42,
    byModality: { recognition: 15, recall: 15, production: 12, unknown: 0 },
  },
  gaps: [],
  ...over,
});

const reading = (attempts: number, successRate: number | null) => ({
  attempts,
  correct: successRate === null ? 0 : Math.round(attempts * successRate),
  successRate,
  meanStability: null,
  lastAt: null,
});

const gapRow = (over: Partial<ModalityGapRow> = {}): ModalityGapRow => ({
  atomType: 'vocabulary_item',
  atomId: 'w1',
  title: 'søknad',
  track: 'lexis',
  parentId: null,
  verdict: 'recognition_only',
  gap: null,
  byModality: {
    recognition: reading(3, 1),
    recall: reading(0, null),
    production: reading(0, null),
    unknown: reading(0, null),
  },
  cardReviews: 3,
  ...over,
});

const data = (over: Partial<StudentMastery> = {}): StudentMastery => ({
  groupId: 'g1',
  courseId: 'c1',
  grid: grid(),
  position: position(),
  workContext: workContext(),
  profile: profile(),
  modalityGap: gap(),
  ...over,
});

const draw = async (over: Partial<StudentMastery> = {}) => {
  vi.mocked(getStudentMastery).mockResolvedValue(data(over));
  render(
    await MasteryTab({
      schoolId: 'school-1',
      workspaceId: 'nordick',
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

  // The block exists because a cell at 78% hides two learners: one who knows the words
  // and one who can pick them out of five. The verdict is the finding, not the number.
  it('names a fact the learner only ever recognises', async () => {
    await draw({ modalityGap: gap({ gaps: [gapRow()] }) });

    expect(screen.getByText('Known one way only')).toBeInTheDocument();
    expect(screen.getByText('søknad')).toBeInTheDocument();
    expect(screen.getByText('Recognition only')).toBeInTheDocument();
    expect(screen.getByText(/never once asked for from memory/i)).toBeInTheDocument();
  });

  /**
   * A modality never attempted is a dash. A zero would say they produce it as badly as
   * they recognise it — the opposite of what the row is reporting.
   */
  it('prints a dash for a modality nobody ever asked, never a zero', async () => {
    await draw({ modalityGap: gap({ gaps: [gapRow()] }) });

    const row = screen.getByText('søknad').closest('li') as HTMLElement;
    expect(row).toHaveTextContent('Produced — never asked');
    expect(row).not.toHaveTextContent('Produced 0%');
  });

  it('measures the gap where the deeper modality was tried and went badly', async () => {
    await draw({
      modalityGap: gap({
        gaps: [
          gapRow({
            verdict: 'production_failing',
            gap: 0.67,
            byModality: {
              recognition: reading(3, 1),
              recall: reading(0, null),
              production: reading(3, 0.33),
              unknown: reading(0, null),
            },
          }),
        ],
      }),
    });

    expect(screen.getByText('Fails when produced')).toBeInTheDocument();
    expect(screen.getByText('−67%')).toBeInTheDocument();
  });

  /**
   * The two empties are different findings, and the first one is about the course: with
   * nothing addressed there is nothing to compare, and saying "known evenly" there would
   * be a verdict drawn from no evidence at all.
   */
  it('tells an unaddressed catalogue apart from a learner with no lopsided facts', async () => {
    await draw({ modalityGap: gap({ summary: { ...gap().summary, addressedAtoms: 0 } }) });
    expect(screen.getByText(/gap in the course’s markup, not in the learner/i)).toBeInTheDocument();

    screen.getByText('Known one way only');
  });

  it('says the facts are known evenly when they are', async () => {
    await draw({ modalityGap: gap() });

    expect(
      screen.getByText(/All 9 facts with enough evidence are known evenly/),
    ).toBeInTheDocument();
  });

  it('says the service could not be asked rather than showing an even learner', async () => {
    await draw({ modalityGap: null });

    expect(
      screen.getByText('Could not ask what this learner knows one way only.'),
    ).toBeInTheDocument();
  });

  /**
   * A thin answer here usually means the course is unaddressed rather than the learner
   * untested, and that is invisible from the rows themselves.
   */
  it('prints the evidence the verdicts stand on', async () => {
    await draw({ modalityGap: gap({ gaps: [gapRow()] }) });

    expect(screen.getByText(/15 facts with an address, 42 observations/)).toBeInTheDocument();
    expect(screen.getByText(/6 have too little evidence to judge/)).toBeInTheDocument();
  });

  it('says a course with no production task at all is a fact about the course', async () => {
    await draw({
      modalityGap: gap({
        gaps: [gapRow()],
        summary: {
          ...gap().summary,
          byModality: { recognition: 15, recall: 15, production: 0, unknown: 0 },
        },
      }),
    });

    expect(screen.getByText(/that is a fact about the course/i)).toBeInTheDocument();
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
