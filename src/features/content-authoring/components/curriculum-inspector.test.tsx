import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import type { CurriculumTreeSelection } from '../types';
import { CurriculumInspector } from './curriculum-inspector';

function renderInspector(selection: CurriculumTreeSelection | null) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CurriculumInspector selection={selection} />
    </NextIntlClientProvider>,
  );
}

describe('CurriculumInspector', () => {
  it('shows the empty-selection prompt when nothing is selected', () => {
    renderInspector(null);
    expect(
      screen.getByText('Select an item to inspect and edit its settings.'),
    ).toBeInTheDocument();
  });

  it('shows level contextual help', () => {
    renderInspector({
      kind: 'level',
      level: { id: 'level-a1', title: 'A1 — Beginner', position: 0, modules: [] },
    });
    expect(screen.getByText('A1 — Beginner')).toBeInTheDocument();
    expect(
      screen.getByText('Levels group modules and map to CEFR bands students see in the reader.'),
    ).toBeInTheDocument();
  });

  it('shows module title (English) when present', () => {
    renderInspector({
      kind: 'module',
      module: {
        id: 'item-module-1',
        containerId: 'module-1',
        versionId: 'module-version-1',
        title: 'Samfunn og kultur',
        titleEn: 'Society and culture',
        position: 0,
        isRequired: true,
        sections: [],
        ungroupedItems: [],
      },
    });
    expect(screen.getByText('Samfunn og kultur')).toBeInTheDocument();
    expect(screen.getByText('Society and culture')).toBeInTheDocument();
  });

  it('shows lesson metadata: type label, duration, xp and state', () => {
    renderInspector({
      kind: 'item',
      sectionTitle: 'Reinforce & read',
      item: {
        id: 'item-1',
        itemType: 'lesson',
        refId: 'lesson-1',
        title: 'En vanlig arbeidsdag',
        position: 0,
        isRequired: true,
        lessonKind: 'text',
        state: 'published',
        durationMinutes: 6,
        xpReward: 10,
      },
    });
    expect(screen.getByText('En vanlig arbeidsdag')).toBeInTheDocument();
    expect(screen.getByText('6 min')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
  });

  it('shows a placeholder dash for missing duration/xp', () => {
    renderInspector({
      kind: 'item',
      sectionTitle: null,
      item: {
        id: 'item-2',
        itemType: 'vocabulary_list',
        refId: 'vocab-1',
        title: 'Ord 1',
        position: 0,
        isRequired: true,
        lessonKind: null,
        state: null,
        durationMinutes: null,
        xpReward: null,
      },
    });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
