import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ContainerVersion } from '@/features/content/types';

vi.mock('../api/use-container-versions', () => ({ useContainerVersions: vi.fn() }));
vi.mock('../api/use-container-preflight', () => ({ useContainerPreflight: vi.fn() }));
// The real dialog imports the publish server action, which cannot load client-side.
vi.mock('./publish-dialog', () => ({
  PublishDialog: ({ trigger }: { trigger?: React.ReactNode }) => (
    <div data-testid="publish-dialog">{trigger}</div>
  ),
}));

const { ModulePublishBlock } = await import('./module-publish-block');
const { useContainerVersions } = await import('../api/use-container-versions');
const { useContainerPreflight } = await import('../api/use-container-preflight');

const DRAFT: ContainerVersion = {
  id: 'ver-2',
  containerId: 'mod-1',
  status: 'draft',
  createdAt: '2026-01-02T00:00:00Z',
};
const PUBLISHED: ContainerVersion = {
  id: 'ver-1',
  containerId: 'mod-1',
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
};

function renderBlock(versions: ContainerVersion[] | undefined, isLoading = false) {
  vi.mocked(useContainerVersions).mockReturnValue({
    data: versions,
    isLoading,
  } as ReturnType<typeof useContainerVersions>);
  vi.mocked(useContainerPreflight).mockReturnValue({
    data: undefined,
  } as ReturnType<typeof useContainerPreflight>);

  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ModulePublishBlock containerId="mod-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ModulePublishBlock', () => {
  it('offers publishing when a published module has a pending draft', () => {
    renderBlock([PUBLISHED, DRAFT]);

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText(/unpublished changes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish module' })).toBeInTheDocument();
  });

  it('warns that a never-published module is invisible to students', () => {
    renderBlock([DRAFT]);

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText(/never been published/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish module' })).toBeInTheDocument();
  });

  it('hides the action when there is nothing left to publish', () => {
    renderBlock([PUBLISHED]);

    expect(screen.getByText(/everything in this module is published/i)).toBeInTheDocument();
    expect(screen.queryByTestId('publish-dialog')).not.toBeInTheDocument();
  });

  it('runs pre-flight only once a draft exists', () => {
    renderBlock([PUBLISHED]);
    expect(useContainerPreflight).toHaveBeenCalledWith('mod-1', false);
  });
});
