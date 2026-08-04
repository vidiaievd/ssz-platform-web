import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ContainerVersion } from '@/features/content/types';

vi.mock('../api/use-container-versions', () => ({ useContainerVersions: vi.fn() }));
vi.mock('../actions/rollback-container', () => ({ rollbackContainerAction: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { VersionHistoryBlock } = await import('./version-history-block');
const { useContainerVersions } = await import('../api/use-container-versions');
const { rollbackContainerAction } = await import('../actions/rollback-container');
const { toast } = await import('sonner');

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
    sunsetAt: null,
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
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <VersionHistoryBlock containerId="course-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('VersionHistoryBlock', () => {
  beforeEach(() => {
    vi.mocked(useContainerVersions).mockReset();
    vi.mocked(rollbackContainerAction).mockReset();
    vi.mocked(rollbackContainerAction).mockResolvedValue({ ok: true, value: undefined } as never);
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

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
  it('offers the way back only on versions a newer release replaced', () => {
    mockVersions({
      data: [
        version({ versionNumber: 1, status: 'deprecated' }),
        version({ versionNumber: 2, status: 'published' }),
        version({ versionNumber: 3, status: 'draft', publishedAt: null }),
      ],
    });
    renderBlock();

    // The live version is already live, and a draft was never live at all.
    expect(screen.getAllByRole('button', { name: /^Restore version/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Restore version 1' })).toBeInTheDocument();
  });

  it('warns that restoring is immediate before it does anything', () => {
    mockVersions({ data: [version({ versionNumber: 1, status: 'deprecated' })] });
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Restore version 1' }));

    expect(screen.getByText('Put v1 back on air?')).toBeInTheDocument();
    expect(screen.getByText(/Students see this version immediately/)).toBeInTheDocument();
    expect(rollbackContainerAction).not.toHaveBeenCalled();
  });

  it('restores the confirmed version', async () => {
    mockVersions({ data: [version({ versionNumber: 1, status: 'deprecated' })] });
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Restore version 1' }));
    fireEvent.click(screen.getByRole('button', { name: /^Restore$/ }));

    await waitFor(() => expect(rollbackContainerAction).toHaveBeenCalledWith('course-1', 'ver-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('v1 is live again.'));
  });

  it('keeps the dialog open and says so when the restore fails', async () => {
    mockVersions({ data: [version({ versionNumber: 1, status: 'deprecated' })] });
    vi.mocked(rollbackContainerAction).mockResolvedValue({
      ok: false,
      error: { code: 'unknown' },
    } as never);
    renderBlock();

    fireEvent.click(screen.getByRole('button', { name: 'Restore version 1' }));
    fireEvent.click(screen.getByRole('button', { name: /^Restore$/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't restore that version."));
    expect(screen.getByText('Put v1 back on air?')).toBeInTheDocument();
  });
  it('distinguishes a version taken off air from one a release replaced', () => {
    mockVersions({
      data: [
        // Superseded: a newer publish set it a sunset date.
        version({
          versionNumber: 1,
          status: 'deprecated',
          deprecatedAt: '2026-07-01T09:00:00Z',
          sunsetAt: '2026-10-01T09:00:00Z',
        }),
        // Unpublished by hand: nothing replaced it, nothing is counting down.
        version({
          versionNumber: 2,
          status: 'deprecated',
          deprecatedAt: '2026-08-01T09:00:00Z',
          sunsetAt: null,
        }),
      ],
    });
    renderBlock();

    const entries = screen.getAllByRole('listitem');
    expect(entries[0]).toHaveTextContent('Taken off air');
    expect(entries[1]).toHaveTextContent('Replaced');
  });
});
