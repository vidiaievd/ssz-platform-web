import { act, render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import type { VocabularyForm } from '@/features/content/types';

const useMediaAsset = vi.fn((_id?: string) => ({ data: undefined }));
vi.mock('@/features/media', () => ({ useMediaAsset: (id?: string) => useMediaAsset(id) }));

const { GlossaryPopover } = await import('./glossary-popover');

const FORMS: VocabularyForm[] = [
  { label: 'Ubestemt entall', value: 'en sykepleier' },
  { label: 'Bestemt entall', value: 'sykepleieren' },
];

function renderPopover(props: Partial<React.ComponentProps<typeof GlossaryPopover>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GlossaryPopover
        word="sykepleier"
        phonetic="/ˈsyːkəˌplɛɪər/"
        pos="noun"
        translation="nurse"
        forms={FORMS}
        form="sykepleieren"
        formLabel="Bestemt entall"
        {...props}
      >
        <span role="button" tabIndex={0} aria-label="Look up: sykepleieren">
          sykepleieren
        </span>
      </GlossaryPopover>
    </NextIntlClientProvider>,
  );
}

function word() {
  return screen.getByRole('button', { name: /look up: sykepleieren/i });
}

/** React's onPointerEnter/Leave are delegated from pointerover/pointerout. */
function hoverIn(pointerType = 'mouse') {
  fireEvent.pointerOver(word(), { pointerType, relatedTarget: null });
}
function hoverOut(pointerType = 'mouse') {
  fireEvent.pointerOut(word(), { pointerType, relatedTarget: document.body });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** jsdom ships no matchMedia, and the hover branch is gated on `(hover: none)`. */
function mockPointerCapabilities({ hover }: { hover: boolean }) {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('hover: none') ? !hover : hover,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockPointerCapabilities({ hover: true });
});

afterEach(() => {
  vi.useRealTimers();
  useMediaAsset.mockClear();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('GlossaryPopover', () => {
  it('shows the translation when the word is clicked', () => {
    renderPopover();
    fireEvent.click(word());

    expect(screen.getByText('nurse')).toBeInTheDocument();
    expect(screen.queryByText(/click for translation/i)).not.toBeInTheDocument();
  });

  it('opens a preview without the translation after hovering with a mouse', () => {
    renderPopover();
    hoverIn();
    advance(400);

    expect(screen.getByText('/ˈsyːkəˌplɛɪər/')).toBeInTheDocument();
    expect(screen.getByText(/click for translation/i)).toBeInTheDocument();
    expect(screen.queryByText('nurse')).not.toBeInTheDocument();
  });

  it('opens nothing when the pointer leaves before the hover delay', () => {
    renderPopover();
    hoverIn();
    advance(300);
    hoverOut();
    advance(400);

    expect(screen.queryByText(/click for translation/i)).not.toBeInTheDocument();
    expect(screen.queryByText('nurse')).not.toBeInTheDocument();
  });

  it('closes the preview shortly after the pointer leaves', () => {
    renderPopover();
    hoverIn();
    advance(400);
    expect(screen.getByText(/click for translation/i)).toBeInTheDocument();

    hoverOut();
    advance(150);
    expect(screen.queryByText(/click for translation/i)).not.toBeInTheDocument();
  });

  it('promotes an open preview to the full card on click', () => {
    renderPopover();
    hoverIn();
    advance(400);
    fireEvent.click(word());

    expect(screen.getByText('nurse')).toBeInTheDocument();
    expect(screen.queryByText(/click for translation/i)).not.toBeInTheDocument();
  });

  it('ignores hover from a touch pointer but still opens the full card on tap', () => {
    renderPopover();
    hoverIn('touch');
    advance(400);
    expect(screen.queryByText(/click for translation/i)).not.toBeInTheDocument();

    fireEvent.click(word());
    expect(screen.getByText('nurse')).toBeInTheDocument();
  });

  it('never opens on hover on a device without a hovering pointer', () => {
    mockPointerCapabilities({ hover: false });
    renderPopover();
    hoverIn();
    advance(400);

    expect(screen.queryByText(/click for translation/i)).not.toBeInTheDocument();
  });

  it('opens the full card on Enter and closes it on Escape', () => {
    renderPopover();
    fireEvent.keyDown(word(), { key: 'Enter' });
    expect(screen.getByText('nurse')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByText('nurse')).not.toBeInTheDocument();
  });

  it('hides the "in the text" line when the matched form is the lemma', () => {
    renderPopover({ form: 'sykepleier', formLabel: null });
    fireEvent.click(word());

    expect(screen.queryByText(/in the text:/i)).not.toBeInTheDocument();
  });

  it('names the matched form and its label when it differs from the lemma', () => {
    renderPopover();
    fireEvent.click(word());

    expect(screen.getByText('in the text: sykepleieren · Bestemt entall')).toBeInTheDocument();
  });

  it('resolves the audio asset only once the full card is open', () => {
    renderPopover({ audioMediaId: 'media-1' });
    hoverIn();
    advance(400);
    expect(useMediaAsset).not.toHaveBeenCalled();

    fireEvent.click(word());
    expect(useMediaAsset).toHaveBeenCalledWith('media-1');
  });
  describe('onOpenLevel', () => {
    it('reports the hover preview once it actually opens, not when the pointer arrives', () => {
      const onOpenLevel = vi.fn();
      renderPopover({ onOpenLevel });

      hoverIn();
      expect(onOpenLevel).not.toHaveBeenCalled();

      advance(400);
      expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('preview');
    });

    it('reports the promotion of a preview to the full card', () => {
      const onOpenLevel = vi.fn();
      renderPopover({ onOpenLevel });

      hoverIn();
      advance(400);
      fireEvent.click(word());

      expect(onOpenLevel.mock.calls).toEqual([['preview'], ['full']]);
    });

    it('reports a single full opening for a click without hover', () => {
      const onOpenLevel = vi.fn();
      renderPopover({ onOpenLevel });

      fireEvent.click(word());

      expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('full');
    });

    it('reports the keyboard opening', () => {
      const onOpenLevel = vi.fn();
      renderPopover({ onOpenLevel });

      fireEvent.keyDown(word(), { key: 'Enter' });

      expect(onOpenLevel).toHaveBeenCalledExactlyOnceWith('full');
    });

    it('reports nothing when the hover is abandoned before the delay', () => {
      const onOpenLevel = vi.fn();
      renderPopover({ onOpenLevel });

      hoverIn();
      advance(200);
      hoverOut();
      advance(400);

      expect(onOpenLevel).not.toHaveBeenCalled();
    });

    it('reports nothing when the card is closed', () => {
      const onOpenLevel = vi.fn();
      renderPopover({ onOpenLevel });

      fireEvent.keyDown(word(), { key: 'Enter' });
      onOpenLevel.mockClear();
      fireEvent.keyDown(word(), { key: 'Enter' });

      expect(onOpenLevel).not.toHaveBeenCalled();
    });
  });
});
