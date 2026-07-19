import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ schoolSlug: 'demo-school' }),
}));
vi.mock('@/lib/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}));

const createContainerAction = vi.fn();
vi.mock('../actions/container', () => ({
  createContainerAction: (...args: unknown[]) => createContainerAction(...args),
}));

const syncStructureSectionsAction = vi.fn();
const listSectionsAction = vi.fn();
vi.mock('../actions/section', () => ({
  syncStructureSectionsAction: (...args: unknown[]) => syncStructureSectionsAction(...args),
  listSectionsAction: (...args: unknown[]) => listSectionsAction(...args),
}));

const applyCefrStarterScaffoldAction = vi.fn();
vi.mock('../actions/apply-starter-scaffold', () => ({
  applyCefrStarterScaffoldAction: (...args: unknown[]) => applyCefrStarterScaffoldAction(...args),
}));

const { useCreateCourseFlow } = await import('./use-create-course-flow');
const { useCreateCourseStore } = await import('../stores/create-course');

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('useCreateCourseFlow', () => {
  beforeEach(() => {
    useCreateCourseStore.getState().reset();
    vi.clearAllMocks();
  });
  afterEach(() => vi.clearAllMocks());

  it('canCreate is false with an empty title, true once a title is set', () => {
    const { result, rerender } = renderHook(() => useCreateCourseFlow(), { wrapper });
    expect(result.current.canCreate).toBe(false);

    act(() => useCreateCourseStore.getState().updateBasics({ title: 'Norsk A1' }));
    rerender();
    expect(result.current.canCreate).toBe(true);
  });

  it('single level system + blank starter: creates the container only, then navigates', async () => {
    useCreateCourseStore.setState({
      basics: { title: 'Norsk A1', targetLanguage: 'nb', description: '' },
      levelSystem: 'single',
      starter: 'blank',
    });
    createContainerAction.mockResolvedValue({ ok: true, value: { id: 'course-1' } });

    const { result } = renderHook(() => useCreateCourseFlow(), { wrapper });
    act(() => result.current.create());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/school/demo-school/content/course-1'));

    expect(createContainerAction).toHaveBeenCalledOnce();
    expect(createContainerAction.mock.calls[0]![0]).toMatchObject({
      title: 'Norsk A1',
      targetLanguage: 'nb',
      levelSystem: 'single',
    });
    expect(syncStructureSectionsAction).not.toHaveBeenCalled();
    expect(applyCefrStarterScaffoldAction).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledOnce();
  });

  it('cefr level system + cefr starter: syncs sections then seeds the starter module with the first section id', async () => {
    useCreateCourseStore.setState({
      basics: { title: 'Norsk A1', targetLanguage: 'nb', description: '' },
      levelSystem: 'cefr',
      starter: 'cefr',
    });
    createContainerAction.mockResolvedValue({ ok: true, value: { id: 'course-1' } });
    syncStructureSectionsAction.mockResolvedValue({ ok: true, value: undefined });
    listSectionsAction.mockResolvedValue({ ok: true, value: [{ id: 'sec-a1' }, { id: 'sec-a2' }] });
    applyCefrStarterScaffoldAction.mockResolvedValue({ ok: true, value: { moduleContainerId: 'mod-1' } });

    const { result } = renderHook(() => useCreateCourseFlow(), { wrapper });
    act(() => result.current.create());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/school/demo-school/content/course-1'));

    expect(syncStructureSectionsAction).toHaveBeenCalledWith('course-1', expect.any(Array));
    expect(applyCefrStarterScaffoldAction).toHaveBeenCalledWith(
      'course-1',
      'nb',
      'private',
      'assigned_only',
      'sec-a1',
      expect.any(Object),
    );
    expect(toastSuccess).toHaveBeenCalledOnce();
  });

  it('shows an error and does not navigate when container creation fails', async () => {
    useCreateCourseStore.setState({
      basics: { title: 'Norsk A1', targetLanguage: 'nb', description: '' },
    });
    createContainerAction.mockResolvedValue({ ok: false, error: { code: 'unknown', message: 'boom' } });

    const { result } = renderHook(() => useCreateCourseFlow(), { wrapper });
    act(() => result.current.create());

    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
    expect(push).not.toHaveBeenCalled();
    expect(result.current.isCreating).toBe(false);
  });

  it('still navigates when the starter scaffold fails (course already exists)', async () => {
    useCreateCourseStore.setState({
      basics: { title: 'Norsk A1', targetLanguage: 'nb', description: '' },
      levelSystem: 'single',
      starter: 'cefr',
    });
    createContainerAction.mockResolvedValue({ ok: true, value: { id: 'course-1' } });
    applyCefrStarterScaffoldAction.mockResolvedValue({ ok: false, error: { code: 'unknown', message: 'boom' } });

    const { result } = renderHook(() => useCreateCourseFlow(), { wrapper });
    act(() => result.current.create());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/school/demo-school/content/course-1'));
    expect(toastError).toHaveBeenCalledOnce();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
