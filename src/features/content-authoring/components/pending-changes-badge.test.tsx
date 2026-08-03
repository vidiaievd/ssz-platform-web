import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { Container } from '@/features/content/types';

import { PendingChangesBadge, hasPendingChanges } from './pending-changes-badge';

const CONTAINER: Container = {
  id: 'course-1',
  slug: 'norsk-b1',
  title: 'Norsk B1',
  containerType: 'course',
  targetLanguage: 'nb',
  difficultyLevel: 'B1',
  visibility: 'public',
  accessTier: 'free_within_school',
  currentPublishedVersionId: 'version-1',
  ownerUserId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderBadge(overrides: Partial<Container>) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PendingChangesBadge container={{ ...CONTAINER, ...overrides }} />
    </NextIntlClientProvider>,
  );
}

describe('hasPendingChanges', () => {
  it('counts a draft ahead of the live version', () => {
    expect(hasPendingChanges({ ...CONTAINER, publishState: 'pending_changes' })).toBe(true);
  });

  it('counts a module students cannot open, even in an up-to-date course', () => {
    // Modules are versioned independently and publishing does not cascade.
    expect(
      hasPendingChanges({ ...CONTAINER, publishState: 'published', pendingModuleCount: 1 }),
    ).toBe(true);
  });

  it('says no when the container and its modules are all live', () => {
    expect(
      hasPendingChanges({ ...CONTAINER, publishState: 'published', pendingModuleCount: 0 }),
    ).toBe(false);
  });
});

describe('PendingChangesBadge', () => {
  it('names how many modules are not released', () => {
    renderBadge({ publishState: 'published', pendingModuleCount: 2 });

    expect(screen.getByText('2 modules not released')).toBeInTheDocument();
  });

  it("reports the container's own unreleased changes", () => {
    renderBadge({ publishState: 'pending_changes', pendingModuleCount: 0 });

    expect(screen.getByText('Unpublished changes')).toBeInTheDocument();
  });

  it('stays quiet when everything is live', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PendingChangesBadge
          container={{ ...CONTAINER, publishState: 'published', pendingModuleCount: 0 }}
        />
      </NextIntlClientProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('stays quiet on a container that was never published', () => {
    // That one is already badged "Draft"; saying it twice is noise.
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PendingChangesBadge
          container={{ ...CONTAINER, currentPublishedVersionId: null, publishState: 'draft' }}
        />
      </NextIntlClientProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('stays quiet when the list was not enriched, rather than guessing', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PendingChangesBadge container={CONTAINER} />
      </NextIntlClientProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
