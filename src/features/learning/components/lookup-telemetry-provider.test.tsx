import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LookupTelemetryProvider, useLookupReporter } from './lookup-telemetry-provider';

function Word({ id }: { id: string }) {
  const report = useLookupReporter();
  return (
    <>
      <button type="button" onClick={() => report(id, 'preview')}>
        {`preview-${id}`}
      </button>
      <button type="button" onClick={() => report(id, 'full')}>
        {`full-${id}`}
      </button>
    </>
  );
}

function renderReader(children = <Word id="vocab-1" />) {
  return render(
    <LookupTelemetryProvider lessonId="lesson-1" lessonVariantId="variant-1">
      {children}
    </LookupTelemetryProvider>,
  );
}

function sentLookups(call: number) {
  const body = vi.mocked(fetch).mock.calls[call]?.[1]?.body as string;
  return (JSON.parse(body) as { lookups: unknown[] }).lookups;
}

function click(name: string) {
  act(() => {
    screen.getByRole('button', { name }).click();
  });
}

async function advanceToFlush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LookupTelemetryProvider', () => {
  it('sends a lookup with the lesson and variant it was rendered for', async () => {
    renderReader();
    click('full-vocab-1');
    await advanceToFlush();

    expect(fetch).toHaveBeenCalledWith('/api/learning/lookups', expect.objectContaining({ method: 'POST' }));
    expect(sentLookups(0)).toEqual([
      expect.objectContaining({
        lessonId: 'lesson-1',
        lessonVariantId: 'variant-1',
        vocabularyItemId: 'vocab-1',
        level: 'full',
      }),
    ]);
  });

  it('counts repeated hovers of the same word once', async () => {
    renderReader();
    click('preview-vocab-1');
    click('preview-vocab-1');
    click('preview-vocab-1');
    await advanceToFlush();

    expect(sentLookups(0)).toHaveLength(1);
  });

  it('keeps the promotion from a hint to a full card as its own signal', async () => {
    renderReader();
    click('preview-vocab-1');
    click('full-vocab-1');
    await advanceToFlush();

    expect(sentLookups(0)).toEqual([
      expect.objectContaining({ level: 'preview' }),
      expect.objectContaining({ level: 'full' }),
    ]);
  });

  it('does not call the network when nothing was looked up', async () => {
    renderReader();
    await advanceToFlush();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('flushes when the reader hides the tab', async () => {
    renderReader();
    click('full-vocab-1');

    act(() => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('flushes what is buffered when the reader leaves the page', async () => {
    const { unmount } = renderReader();
    click('full-vocab-1');
    unmount();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the flush fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    renderReader();
    click('full-vocab-1');

    await expect(advanceToFlush()).resolves.toBeUndefined();
  });

  it('reports nothing outside a provider', () => {
    render(<Word id="vocab-1" />);
    click('full-vocab-1');

    expect(fetch).not.toHaveBeenCalled();
  });
});
