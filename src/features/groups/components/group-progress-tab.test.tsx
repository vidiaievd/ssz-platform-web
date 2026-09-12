import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { GroupProgress } from '@/features/analytics/types';

import { GroupProgressTab } from './group-progress-tab';

const SCHOOL = 'school-1';
const GROUP = 'group-1';

const unit = (
  over: Partial<GroupProgress['units'][number]> = {},
): GroupProgress['units'][number] => ({
  unitId: 'u1',
  no: 1,
  title: 'Leksjon 17',
  items: 4,
  delivered: { value: 1, lessons: 2, lastHeldAt: '2026-09-08T00:00:00.000Z', linked: true },
  absorbed: { median: 70, p25: 60, p75: 80, n: 5 },
  quality: 65,
  state: 'ok',
  ...over,
});

const progress = (over: Partial<GroupProgress> = {}): GroupProgress => ({
  groupId: GROUP,
  courseId: 'course-1',
  updatedAt: new Date().toISOString(),
  minWeightedSample: 8,
  workContextSplitFrom: '2026-09-04',
  deliveryUnavailable: false,
  units: [unit()],
  unlinkedPlanUnits: [],
  summary: {
    deliveredUnits: 1,
    plannedUnits: 4,
    lessonsHeld: 3,
    lessonsPlanned: 12,
    absorbedMedian: 70,
    belowLine: 1,
    belowLineRule: 'under half the group median',
    notJudgeable: 2,
    lastActivityAt: new Date().toISOString(),
  },
  workContext: [
    { key: 'homework', attempts: 40, share: 60, median: 72 },
    { key: 'self_study', attempts: 20, share: 30, median: 58 },
    { key: 'classwork', attempts: 0, share: 0, median: null },
    { key: null, attempts: 7, share: 10, median: 61 },
  ],
  workContextUnattributed: 0,
  ...over,
});

function renderTab(heatmap = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      <QueryClientProvider client={client}>
        <GroupProgressTab
          schoolId={SCHOOL}
          groupId={GROUP}
          schoolSlug="nordick"
          canSeePersonalResults={heatmap}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const answer = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body } as Response);

/** Routes the two queries the tab makes by URL, so the heatmap can fail on its own. */
const route = (progressBody: unknown, heatmapBody: unknown, heatmapOk = true) =>
  vi
    .fn()
    .mockImplementation(async (url: string) =>
      url.endsWith('/heatmap')
        ? ({ ok: heatmapOk, json: async () => heatmapBody } as Response)
        : ({ ok: true, json: async () => progressBody } as Response),
    );

const heatmapBody = {
  groupId: GROUP,
  courseId: 'course-1',
  updatedAt: new Date().toISOString(),
  minWeightedSample: 8,
  deliveryUnavailable: false,
  units: [{ unitId: 'u1', no: 1, title: 'Leksjon 17' }],
  rows: [
    {
      studentId: 's1',
      displayName: 'Anna Lind',
      lastActivityAt: new Date().toISOString(),
      cells: [{ state: 'ok' as const, value: 70, weightedSample: 12 }],
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('the four pictures a group can be', () => {
  it('asks for a course before it draws anything', async () => {
    vi.stubGlobal('fetch', answer(progress({ courseId: null, units: [] })));
    renderTab();

    expect(await screen.findByText('No course is attached to this group')).toBeTruthy();
    // No chart, and no summary claiming zeroes about a group teaching nothing.
    expect(document.querySelector('svg[role="img"]')).toBeNull();
  });

  it('asks for lessons when nothing has been taught', async () => {
    vi.stubGlobal(
      'fetch',
      answer(
        progress({
          summary: { ...progress().summary, lessonsHeld: 0, absorbedMedian: null, belowLine: 0 },
        }),
      ),
    );
    renderTab();

    expect(await screen.findByText('No lessons held yet')).toBeTruthy();
    // The summary is still shown: delivered is a real number even here.
    expect(screen.getByText('Delivered')).toBeTruthy();
  });

  it('prints a dash, never a zero, when lessons happened but nothing was measured', async () => {
    vi.stubGlobal(
      'fetch',
      answer(
        progress({
          summary: { ...progress().summary, absorbedMedian: null, belowLine: 0 },
          units: [unit({ absorbed: null, quality: null, state: 'notStarted' })],
        }),
      ),
    );
    renderTab();

    await screen.findByText('Absorbed median');
    const value = screen.getByText('Absorbed median').nextElementSibling;
    expect(value?.textContent).toBe('—');
    expect(value?.textContent).not.toBe('0%');
    expect(screen.getByText(/nothing measured yet/)).toBeTruthy();
  });

  it('draws the chart when there is something to draw', async () => {
    vi.stubGlobal('fetch', answer(progress()));
    renderTab();

    await waitFor(() => expect(document.querySelector('svg[role="img"]')).toBeTruthy());
    expect(screen.getByText('70%')).toBeTruthy();
    expect(screen.getByText('1/4')).toBeTruthy();
  });
});

describe('what the tab says when it cannot say anything', () => {
  it('blames the service, not the group, when analytics is unreachable', async () => {
    vi.stubGlobal('fetch', answer({ error: 'nope' }, false));
    renderTab();

    expect(await screen.findByText(/fact about the service, not about this group/)).toBeTruthy();
  });
});

describe('who may see named results', () => {
  it('does not even ask for the map when the viewer may not see it', async () => {
    const fetcher = route(progress(), heatmapBody);
    vi.stubGlobal('fetch', fetcher);
    renderTab(false);

    await screen.findByText('Delivered against absorbed');
    expect(screen.queryByText('Students × units')).toBeNull();
    // A scheduler's browser never carries these rows at all.
    expect(fetcher.mock.calls.every(([url]) => !String(url).endsWith('/heatmap'))).toBe(true);
  });

  it('draws the map, and links only from a measured cell', async () => {
    vi.stubGlobal('fetch', route(progress(), heatmapBody));
    renderTab(true);

    expect(await screen.findByText('Students × units')).toBeTruthy();
    // Two copies in the DOM — the phone's folded one and the desktop one — and jsdom
    // renders both, closed `details` included.
    expect(await screen.findAllByText('Anna Lind')).toHaveLength(2);

    const links = await screen.findAllByRole('link', { name: /Anna Lind/ });
    expect(links[0]?.getAttribute('href')).toBe('/school/nordick/students/s1?tab=mastery&unit=u1');
  });

  it('empties the map alone when it fails, leaving the chart standing', async () => {
    vi.stubGlobal('fetch', route(progress(), { error: 'nope' }, false));
    renderTab(true);

    expect(await screen.findByText(/could not load the per-student map/)).toBeTruthy();
    expect(screen.getByText('Delivered against absorbed')).toBeTruthy();
  });
});

describe('plan units with nothing behind them', () => {
  it('shows them always, uncollapsed', async () => {
    vi.stubGlobal(
      'fetch',
      answer(
        progress({
          unlinkedPlanUnits: [
            {
              curriculumUnitId: 'p1',
              title: 'Repetisjon',
              lessons: 2,
              lastHeldAt: '2026-09-05T00:00:00.000Z',
            },
          ],
        }),
      ),
    );
    renderTab();

    expect(await screen.findByText('Repetisjon')).toBeTruthy();
    expect(screen.getByText(/no course unit behind them/)).toBeTruthy();
  });
});

describe('the timetable being unreachable', () => {
  it('says so rather than drawing a course nobody taught', async () => {
    vi.stubGlobal(
      'fetch',
      answer(
        progress({
          deliveryUnavailable: true,
          units: [unit({ delivered: null })],
        }),
      ),
    );
    renderTab();

    expect(await screen.findByText(/could not ask the timetable/)).toBeTruthy();
  });
});
