import { describe, expect, it } from 'vitest';

import type {
  CourseLevelGroup,
  UnitContentsItem,
  UnitContentsResult,
  UnitSummary,
} from '@/features/learning';

import {
  mapCourseLevelsToSidebarLevels,
  mapUnitContentsToSections,
  practiceItemId,
  practiceSectionIdOf,
  resolveNavigableItemId,
} from './map-reader-data';
import type { ReaderSidebarSection } from '../types';

const unit = (id: string, position: number): UnitSummary => ({
  id,
  position,
  title: `Unit ${position}`,
  status: 'active',
  completedLessons: 0,
  totalLessons: 3,
});

const levels: CourseLevelGroup[] = [
  { id: 'l1', title: 'Leksjon 1', position: 1, units: [unit('u1', 1), unit('u2', 2)] },
  { id: 'l2', title: 'Leksjon 2', position: 2, units: [unit('u3', 3)] },
];

const activeSections: ReaderSidebarSection[] = [
  {
    id: 'sec-1',
    label: 'Øvelser',
    items: [
      {
        id: 'i1',
        kind: 'exercise',
        title: 'Oppgave 1',
        durationLabel: '1 min',
        status: 'available',
        href: '/x',
      },
    ],
  },
];

describe('mapCourseLevelsToSidebarLevels', () => {
  it('marks the level holding the active unit and attaches its sections there only', () => {
    const mapped = mapCourseLevelsToSidebarLevels(levels, 'u2', activeSections);

    expect(mapped.map((l) => l.active)).toEqual([true, false]);
    expect(mapped[0]!.units.map((u) => u.sections.length)).toEqual([0, 1]);
    expect(mapped[1]!.units[0]!.sections).toEqual([]);
  });

  it('keeps level identity and order', () => {
    const mapped = mapCourseLevelsToSidebarLevels(levels, 'u3', activeSections);

    expect(mapped.map((l) => [l.id, l.title, l.position])).toEqual([
      ['l1', 'Leksjon 1', 1],
      ['l2', 'Leksjon 2', 2],
    ]);
  });

  it('returns an empty list for an ungrouped course', () => {
    expect(mapCourseLevelsToSidebarLevels([], 'u1', activeSections)).toEqual([]);
  });
});

/* ── collapsed exercise sections ───────────────────────────────────────── */

const exerciseItem = (id: string, status: UnitContentsItem['status']): UnitContentsItem => ({
  id,
  contentType: 'EXERCISE',
  contentId: `c-${id}`,
  title: 'Short Answer',
  lessonKind: null,
  durationMinutes: 1,
  xpReward: 10,
  status,
});

const contentsWith = (sections: UnitContentsResult['sections']): UnitContentsResult => ({
  moduleId: 'm1',
  moduleTitle: '1A',
  sections,
  ungroupedItems: [],
});

const labels = {
  other: 'Other',
  practiceTitle: 'All exercises',
  practiceCount: (n: number) => `${n} tasks`,
};

const toSections = (contents: UnitContentsResult) =>
  mapUnitContentsToSections(contents, 'course-1', (m) => `${m} min`, labels);

describe('mapUnitContentsToSections — exercise sections', () => {
  it('collapses a multi-exercise section into one practice entry', () => {
    const contents = contentsWith([
      {
        id: 'sec-ex',
        title: 'Øvelser',
        items: [exerciseItem('e1', 'available'), exerciseItem('e2', 'available')],
      },
    ]);

    const [section] = toSections(contents);

    expect(section!.items).toHaveLength(1);
    expect(section!.items[0]).toMatchObject({
      id: 'practice-sec-ex',
      title: 'All exercises',
      durationLabel: '2 tasks',
      status: 'available',
      href: '/student/courses/course-1/m1/practice-sec-ex',
    });
  });

  it('leaves a single exercise and mixed sections alone', () => {
    const contents = contentsWith([
      { id: 'sec-one', title: 'Øvelser', items: [exerciseItem('e1', 'available')] },
      {
        id: 'sec-mixed',
        title: 'Tekst',
        items: [
          { ...exerciseItem('e2', 'available'), contentType: 'LESSON', lessonKind: 'text' },
          exerciseItem('e3', 'available'),
        ],
      },
    ]);

    const sections = toSections(contents);

    expect(sections[0]!.items.map((i) => i.id)).toEqual(['e1']);
    expect(sections[1]!.items.map((i) => i.id)).toEqual(['e2', 'e3']);
  });

  it('rolls the set status up worst-first', () => {
    const status = (items: UnitContentsItem[]) =>
      toSections(contentsWith([{ id: 's', title: 'Ø', items }]))[0]!.items[0]!.status;

    expect(status([exerciseItem('a', 'completed'), exerciseItem('b', 'completed')])).toBe('completed');
    expect(status([exerciseItem('a', 'locked'), exerciseItem('b', 'locked')])).toBe('locked');
    expect(status([exerciseItem('a', 'completed'), exerciseItem('b', 'available')])).toBe('in_progress');
    expect(status([exerciseItem('a', 'available'), exerciseItem('b', 'available')])).toBe('available');
  });
});

describe('practice item ids', () => {
  it('round-trips a section id', () => {
    expect(practiceSectionIdOf(practiceItemId('sec-ex'))).toBe('sec-ex');
    expect(practiceSectionIdOf('some-item-id')).toBeNull();
  });

  it('routes an exercise inside a collapsed section to its practice page', () => {
    const contents = contentsWith([
      {
        id: 'sec-ex',
        title: 'Øvelser',
        items: [exerciseItem('e1', 'available'), exerciseItem('e2', 'available')],
      },
      { id: 'sec-one', title: 'Tekst', items: [exerciseItem('e3', 'available')] },
    ]);

    expect(resolveNavigableItemId(contents, 'e1')).toBe('practice-sec-ex');
    expect(resolveNavigableItemId(contents, 'e3')).toBe('e3');
  });
});
