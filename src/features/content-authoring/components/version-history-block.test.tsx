import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ContainerVersion } from '@/features/content/types';

vi.mock('../api/use-container-versions', () => ({ useContainerVersions: vi.fn() }));

const { VersionHistoryBlock } = await import('./version-history-block');
const { useContainerVersions } = await import('../api/use-container-versions');

function version(
  overrides: Partial<ContainerVersion> & { versionNumber: number },
): ContainerVersion {
  return {
    id: `ver-${overrides.versionNumber}`,
    containerId: 'course-1',
    status: 'published',
    changelog: null,
    publishedAt: '2026-07-01T09:00:00Z',
    deprecatedAt: null,
    createdAt: '2026-06-01T09:00:00Z',
    ...overrides,
  };
}

function mockVersions(
  state: Partial<{ data: ContainerVersion[]; isLoading: boolean; isError: boolean }>,
) {
  vi.mocked(useContainerVersions).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...state,
  } as never);
}

function renderBlock() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <VersionHistoryBlock containerId="course-1" />
    </NextIntlClientProvider>,
  );
}

describe('VersionHistoryBlock', () => {
  beforeEach(() => vi.mocked(useContainerVersions).mockReset());

  it('lists releases newest first, with the notes the author wrote', () => {
    mockVersions({
      data: [
        version({ versionNumber: 1, status: 'deprecated', changelog: 'First release.' }),
        version({ versionNumber: 2, changelog: 'Added 5 new exercises.' }),
      ],
    });
    renderBlock();

    const entries = screen.getAllByRole('listitem');
    expect(entries[0]).toHaveTextContent('v2');
    expect(entries[0]).toHaveTextContent('Added 5 new exercises.');
    expect(entries[1]).toHaveTextContent('v1');
    expect(entries[1]).toHaveTextContent('First release.');
  });

  it('says so when a release carried no notes', () => {
    // Notes are optional, and a blank line where text belongs reads as a bug.
    mockVersions({ data: [version({ versionNumber: 2, changelog: '   ' })] });
    renderBlock();

    expect(screen.getByText('No release notes')).toBeInTheDocument();
  });

  it('dates an unpublished draft by when it was opened', () => {
    mockVersions({
      data: [version({ versionNumber: 3, status: 'draft', publishedAt: null })],
    });
    renderBlock();

    expect(screen.getByRole('listitem')).toHaveTextContent('Draft');
    expect(screen.getByRole('listitem')).toHaveTextContent('Jun 1, 2026');
  });

  it('reports a failed load instead of an empty history', () => {
    mockVersions({ isError: true });
    renderBlock();

    expect(screen.getByText("Couldn't load the version history.")).toBeInTheDocument();
    expect(screen.queryByText('No versions yet.')).not.toBeInTheDocument();
  });
});
