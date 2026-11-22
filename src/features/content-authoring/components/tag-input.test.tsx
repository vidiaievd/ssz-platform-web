import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../actions/tag', () => ({
  assignTagAction: vi.fn(async () => ({ ok: true, value: undefined })),
  createAndAssignTagAction: vi.fn(async () => ({ ok: true, value: {} })),
  removeTagAction: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock('../api/use-authoring-tags', () => ({
  useEntityTags: vi.fn(() => ({
    data: [{ id: 't-on', name: 'Verbs', slug: 'verbs', category: 'other', scope: 'school', ownerSchoolId: 'sch1', createdAt: '' }],
    isLoading: false,
  })),
  useTagSuggestions: vi.fn(() => ({
    data: [
      { id: 't-on', name: 'Verbs' },
      { id: 't-a1', name: 'A1' },
    ],
  })),
}));

const { TagInput } = await import('./tag-input');
const actions = await import('../actions/tag');
const { toast } = await import('sonner');
const { useTagSuggestions } = await import('../api/use-authoring-tags');

function draw(ownerSchoolId: string | null = 'sch1') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <TagInput entityType="container" entityId="c1" ownerSchoolId={ownerSchoolId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: /add tag/i }));
}

describe('TagInput', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks for the global tags plus the school’s own', () => {
    draw('sch1');
    expect(vi.mocked(useTagSuggestions)).toHaveBeenCalledWith('sch1', '', false);
  });

  it('puts an offered tag on the course by its id, and does not offer one already on it', async () => {
    draw();
    openPicker();
    expect(screen.queryByRole('option', { name: 'Verbs' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'A1' }));
    await waitFor(() => expect(actions.assignTagAction).toHaveBeenCalledWith('container', 'c1', 't-a1'));
    expect(actions.createAndAssignTagAction).not.toHaveBeenCalled();
  });

  it('takes a tag off the course without deleting the tag', async () => {
    draw();
    fireEvent.click(screen.getByRole('button', { name: /remove tag verbs/i }));
    await waitFor(() => expect(actions.removeTagAction).toHaveBeenCalledWith('container', 'c1', 't-on'));
  });

  it('creates a new school tag for a name nobody has', async () => {
    draw();
    openPicker();
    fireEvent.change(screen.getByPlaceholderText(/search or create/i), { target: { value: 'Travel' } });
    fireEvent.click(screen.getByRole('option', { name: /create.*travel/i }));
    await waitFor(() =>
      expect(actions.createAndAssignTagAction).toHaveBeenCalledWith('container', 'c1', 'Travel', 'sch1'),
    );
  });

  it('offers no "create" for a name already on offer, whatever its case', () => {
    draw();
    openPicker();
    fireEvent.change(screen.getByPlaceholderText(/search or create/i), { target: { value: 'a1' } });
    expect(screen.queryByRole('option', { name: /create/i })).toBeNull();
  });

  it('offers no "create" on a material without a school', () => {
    draw(null);
    openPicker();
    fireEvent.change(screen.getByPlaceholderText(/search or create/i), { target: { value: 'Travel' } });
    expect(screen.queryByRole('option', { name: /create/i })).toBeNull();
  });

  it('explains a refused creation (teacher) instead of a generic error', async () => {
    vi.mocked(actions.createAndAssignTagAction).mockResolvedValueOnce({
      ok: false,
      error: { code: 'forbidden', message: 'no' },
    } as never);
    draw();
    openPicker();
    fireEvent.change(screen.getByPlaceholderText(/search or create/i), { target: { value: 'Travel' } });
    fireEvent.click(screen.getByRole('option', { name: /create.*travel/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(enMessages.Authoring.tags.createForbidden));
  });
});
