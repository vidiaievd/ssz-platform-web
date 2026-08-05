import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { ContainerPublishState } from '@/features/content/types';

import { ModulePublishBlock } from './module-publish-block';

function renderBlock(publishState: ContainerPublishState) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ModulePublishBlock publishState={publishState} />
    </NextIntlClientProvider>,
  );
}

describe('ModulePublishBlock', () => {
  it('says a published module with a pending draft is not fully live', () => {
    renderBlock('pending_changes');

    expect(screen.getByText('Unpublished changes')).toBeInTheDocument();
    expect(screen.getByText(/unpublished changes\./i)).toBeInTheDocument();
  });

  it('warns that a never-published module is invisible to students', () => {
    renderBlock('draft');

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText(/never been published/i)).toBeInTheDocument();
  });

  it('confirms when a module is fully published', () => {
    renderBlock('published');

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText(/everything in this module is published/i)).toBeInTheDocument();
  });

  it('never offers a publish of its own — releasing happens in one place', () => {
    renderBlock('pending_changes');

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
