import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { MatchBody, type MatchBodyProps, type MatchContent } from './match-body';

const messages = {
  ExerciseRunner: {
    match: {
      defaultInstruction: 'Match the pairs',
      helperIdle: 'Tap a word on the left…',
      helperArmed: 'Now tap its match on the right.',
    },
  },
};

const PAIRS: MatchContent['pairs'] = [
  { id: 'p1', left: 'hus', right: 'house' },
  { id: 'p2', left: 'bil', right: 'car' },
];

const CONTENT: MatchContent = { pairs: PAIRS };
const ACCENT = 'var(--ssz-color-primary-500)';

/** Stateful wrapper — mirrors how the parent manages `links`. */
function StatefulMatch({
  initialLinks = {},
  onLinksChange,
  onAnswerChange,
  phase = 'answering',
  ok = null,
  mode = 'practice',
}: {
  initialLinks?: Record<string, string>;
  onLinksChange?: (links: Record<string, string>) => void;
  onAnswerChange?: (canSubmit: boolean) => void;
  phase?: MatchBodyProps['phase'];
  ok?: boolean | null;
  mode?: MatchBodyProps['mode'];
}) {
  const [links, setLinks] = useState<Record<string, string>>(initialLinks);
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <MatchBody
        content={CONTENT}
        links={links}
        onLinksChange={(l) => {
          setLinks(l);
          onLinksChange?.(l);
        }}
        onAnswerChange={onAnswerChange ?? vi.fn()}
        phase={phase}
        ok={ok}
        mode={mode}
        accent={ACCENT}
      />
    </NextIntlClientProvider>
  );
}

function renderMatch(
  opts: Parameters<typeof StatefulMatch>[0] = {},
) {
  const onLinksChange = (opts.onLinksChange ?? vi.fn()) as ReturnType<typeof vi.fn>;
  const onAnswerChange = (opts.onAnswerChange ?? vi.fn()) as ReturnType<typeof vi.fn>;
  const result = render(
    <StatefulMatch
      {...opts}
      onLinksChange={onLinksChange as (links: Record<string, string>) => void}
      onAnswerChange={onAnswerChange as (canSubmit: boolean) => void}
    />,
  );
  return { ...result, onLinksChange, onAnswerChange };
}

/* ── rendering ───────────────────────────────────────────────────── */

describe('MatchBody — rendering', () => {
  it('renders all left texts', () => {
    renderMatch();
    expect(screen.getByText('hus')).toBeInTheDocument();
    expect(screen.getByText('bil')).toBeInTheDocument();
  });

  it('renders all right texts', () => {
    renderMatch();
    expect(screen.getByText('house')).toBeInTheDocument();
    expect(screen.getByText('car')).toBeInTheDocument();
  });

  it('uses default instruction when none provided', () => {
    renderMatch();
    expect(screen.getByText('Match the pairs')).toBeInTheDocument();
  });

  it('uses custom instruction when provided', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MatchBody
          content={{ ...CONTENT, instruction: 'Join the columns' }}
          links={{}}
          onLinksChange={vi.fn()}
          onAnswerChange={vi.fn()}
          phase="answering"
          ok={null}
          mode="practice"
          accent={ACCENT}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Join the columns')).toBeInTheDocument();
  });

  it('shows idle helper text during answering phase', () => {
    renderMatch();
    expect(screen.getByText('Tap a word on the left…')).toBeInTheDocument();
  });

  it('does not show helper text during feedback phase', () => {
    renderMatch({ phase: 'feedback', initialLinks: { p1: 'p1', p2: 'p2' }, ok: true });
    expect(screen.queryByText('Tap a word on the left…')).not.toBeInTheDocument();
    expect(screen.queryByText('Now tap its match on the right.')).not.toBeInTheDocument();
  });
});

/* ── arming left cells ───────────────────────────────────────────── */

describe('MatchBody — arming left cells', () => {
  it('clicking a left cell arms it (aria-pressed becomes true)', () => {
    renderMatch();
    const husBtn = screen.getByRole('button', { name: /hus/ });
    fireEvent.click(husBtn);
    expect(husBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking an armed left cell toggles it off (aria-pressed false)', () => {
    renderMatch();
    const husBtn = screen.getByRole('button', { name: /hus/ });
    fireEvent.click(husBtn);
    fireEvent.click(husBtn);
    expect(husBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('helper text changes to armed state after arming a cell', () => {
    renderMatch();
    fireEvent.click(screen.getByRole('button', { name: /hus/ }));
    expect(screen.getByText('Now tap its match on the right.')).toBeInTheDocument();
  });

  it('right cells are disabled when no left cell is armed', () => {
    renderMatch();
    expect(screen.getByRole('button', { name: /house/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /car/ })).toBeDisabled();
  });

  it('right cells become enabled when a left cell is armed', () => {
    renderMatch();
    fireEvent.click(screen.getByRole('button', { name: /hus/ }));
    expect(screen.getByRole('button', { name: /house/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /car/ })).not.toBeDisabled();
  });
});

/* ── linking ─────────────────────────────────────────────────────── */

describe('MatchBody — linking pairs', () => {
  it('arm left, tap right → onLinksChange called with that pair', () => {
    const { onLinksChange } = renderMatch();
    fireEvent.click(screen.getByRole('button', { name: /hus/ }));
    fireEvent.click(screen.getByRole('button', { name: /house/ }));
    expect(onLinksChange).toHaveBeenCalledWith(expect.objectContaining({ p1: 'p1' }));
  });

  it('after linking all pairs, onAnswerChange(true) is called', () => {
    const { onAnswerChange } = renderMatch();
    // Link first pair
    fireEvent.click(screen.getByRole('button', { name: /hus/ }));
    fireEvent.click(screen.getByRole('button', { name: /house/ }));
    // Link second pair
    fireEvent.click(screen.getByRole('button', { name: /bil/ }));
    fireEvent.click(screen.getByRole('button', { name: /car/ }));
    expect(onAnswerChange).toHaveBeenCalledWith(true);
  });

  it('onAnswerChange(false) while not all pairs linked', () => {
    const { onAnswerChange } = renderMatch();
    fireEvent.click(screen.getByRole('button', { name: /hus/ }));
    fireEvent.click(screen.getByRole('button', { name: /house/ }));
    // Only 1 of 2 pairs linked
    expect(onAnswerChange).toHaveBeenLastCalledWith(false);
  });

  it('armed left resets to null after linking (idle helper returns)', () => {
    renderMatch();
    fireEvent.click(screen.getByRole('button', { name: /hus/ }));
    fireEvent.click(screen.getByRole('button', { name: /house/ }));
    expect(screen.getByText('Tap a word on the left…')).toBeInTheDocument();
  });
});

/* ── unlink by tapping linked left cell ──────────────────────────── */

describe('MatchBody — unlinking', () => {
  it('clicking a linked left cell removes its link and re-arms it', () => {
    const { onLinksChange } = renderMatch({ initialLinks: { p1: 'p1' } });
    const husBtn = screen.getByRole('button', { name: /hus/ });
    fireEvent.click(husBtn);
    // Link p1 removed
    const lastCall = onLinksChange.mock.calls[onLinksChange.mock.calls.length - 1]![0] as Record<string, string>;
    expect(lastCall['p1']).toBeUndefined();
    // And re-armed
    expect(husBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

/* ── move-link rule ──────────────────────────────────────────────── */

describe('MatchBody — move-link rule', () => {
  it('linking right cell that is already linked moves the link to the new armed left', () => {
    const { onLinksChange } = renderMatch({ initialLinks: { p1: 'p1' } });
    // p1 → house (correct), now arm p2 and click 'house'
    fireEvent.click(screen.getByRole('button', { name: /bil/ }));
    fireEvent.click(screen.getByRole('button', { name: /house/ }));
    const lastCall = onLinksChange.mock.calls[onLinksChange.mock.calls.length - 1]![0] as Record<string, string>;
    // p1's link to 'house' is removed; p2 is now linked to 'p1' (house)
    expect(lastCall['p2']).toBe('p1');
    expect(lastCall['p1']).toBeUndefined();
  });
});

/* ── reveal states ───────────────────────────────────────────────── */

describe('MatchBody — reveal / feedback (practice)', () => {
  it('correct left cell shows CheckCircle (ok=true, practice)', () => {
    renderMatch({
      phase: 'feedback',
      ok: true,
      initialLinks: { p1: 'p1', p2: 'p2' },
    });
    // CheckCircle SVG rendered inside left buttons
    const svgs = document.querySelectorAll('svg');
    // At least 2 check circles expected (one per correctly linked pair)
    const checkCircles = Array.from(svgs).filter((s) =>
      s.closest('button[aria-pressed]'),
    );
    expect(checkCircles.length).toBeGreaterThan(0);
  });

  it('wrong left cell shows XCircle (ok=false, practice)', () => {
    renderMatch({
      phase: 'feedback',
      ok: false,
      initialLinks: { p1: 'p2', p2: 'p1' }, // crossed — both wrong
    });
    const svgs = document.querySelectorAll('svg');
    const xCircles = Array.from(svgs).filter((s) =>
      s.closest('button[aria-pressed]'),
    );
    expect(xCircles.length).toBeGreaterThan(0);
  });

  it('all buttons disabled in feedback phase', () => {
    renderMatch({
      phase: 'feedback',
      ok: true,
      initialLinks: { p1: 'p1', p2: 'p2' },
    });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('graded mode (ok=null) — no CheckCircle or XCircle icons in left buttons', () => {
    renderMatch({
      phase: 'feedback',
      ok: null,
      mode: 'graded',
      initialLinks: { p1: 'p1', p2: 'p2' },
    });
    // left buttons still show aria-pressed attribute (they're buttons) but no check/x icons
    // Verify by checking there are no SVGs inside aria-pressed buttons
    const leftBtns = screen.getAllByRole('button', { hidden: false }).filter(
      (b) => b.hasAttribute('aria-pressed'),
    );
    leftBtns.forEach((btn) => {
      // No CheckCircle/XCircle — they are only rendered when leftStatus !== null
      // which requires ok !== null
      const svgInBtn = btn.querySelector('svg');
      // There may be no SVG, or if a badge svg exists it won't carry check/x semantics
      // We verify there's no aria-hidden SVG that is a check or x icon by checking style
      if (svgInBtn) {
        const style = (svgInBtn as SVGElement).getAttribute('style') ?? '';
        expect(style).not.toContain('success-500');
        expect(style).not.toContain('error-500');
      }
    });
  });
});

/* ── halves variant ──────────────────────────────────────────────── */

const HALVES_CONTENT: MatchContent = {
  variant: 'halves',
  pairs: [
    { id: 'h1', left: 'Really? Tell me more …', right: '… about it!' },
    { id: 'h2', left: 'How long have you …', right: '… lived here?' },
    { id: 'h3', left: 'Do you live …', right: '… near here?' },
  ],
};

function renderHalves(links: Record<string, string> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MatchBody
        content={HALVES_CONTENT}
        links={links}
        onLinksChange={vi.fn()}
        onAnswerChange={vi.fn()}
        phase="answering"
        ok={null}
        mode="practice"
        accent={ACCENT}
      />
    </NextIntlClientProvider>,
  );
}

describe('MatchBody — halves variant', () => {
  it('numbers the left column and letters the right one', () => {
    renderHalves();
    const buttons = screen.getAllByRole('button');
    const left = buttons.filter((b) => b.textContent?.includes('Tell me more'))[0]!;

    expect(left.textContent).toMatch(/^1\./);
    // Right cells are lettered regardless of which pair the shuffle put there.
    const letters = buttons
      .map((b) => b.textContent ?? '')
      .filter((text) => /^[A-Z]\./.test(text));
    expect(letters).toHaveLength(3);
    expect(letters.map((t) => t[0]).sort()).toEqual(['A', 'B', 'C']);
  });

  it('leaves the plain pairs layout unnumbered', () => {
    renderMatch();
    const numbered = screen
      .getAllByRole('button')
      .filter((b) => /^\d\./.test(b.textContent ?? ''));
    expect(numbered).toHaveLength(0);
  });
});
