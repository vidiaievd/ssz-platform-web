import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { RuleMarker } from './rule-marker';

const ATOMS = [
  {
    atomId: 'a1',
    ruleId: 'r1',
    ruleTitle: 'Inversion',
    title: 'V2 after an adverb',
    description: 'I går var jeg …',
  },
  {
    atomId: 'a2',
    ruleId: 'r2',
    ruleTitle: 'Perfektum',
    title: 'har + participle',
    description: null,
  },
];

function mount(props: Partial<React.ComponentProps<typeof RuleMarker>> = {}) {
  const onToggle = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={new QueryClient()}>
        <RuleMarker school="s1" id="att-1" marked={[]} onToggle={onToggle} editable {...props} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return onToggle;
}

afterEach(() => vi.unstubAllGlobals());

describe('RuleMarker', () => {
  it('does not read the catalogue until the picker is opened', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mark a rule' })).toBeTruthy();
  });

  it('lists the course rules, narrows them by the search and marks the chosen one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ atoms: ATOMS })),
    );
    const onToggle = mount();

    fireEvent.click(screen.getByRole('button', { name: 'Mark a rule' }));
    await screen.findByText('Inversion · V2 after an adverb');
    expect(screen.getByText('Perfektum · har + participle')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'perfekt' } });
    expect(screen.queryByText('Inversion · V2 after an adverb')).toBeNull();

    fireEvent.click(screen.getByText('Perfektum · har + participle'));
    expect(onToggle).toHaveBeenCalledWith('a2');
  });

  it('draws a marked rule as a chip with a way to take it off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ atoms: ATOMS })),
    );
    const onToggle = mount({ marked: ['a1'] });

    await waitFor(() => expect(screen.getByText('Inversion · V2 after an adverb')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Remove Inversion · V2 after an adverb' }));
    expect(onToggle).toHaveBeenCalledWith('a1');
  });

  it('says so when the rules could not be read, rather than that there are none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 502 })),
    );
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Mark a rule' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/No rule of this course/)).toBeNull();
  });

  it('is a plain read-only chip list once the verdict is given, and absent when nothing was marked', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ atoms: ATOMS })),
    );
    mount({ editable: false });

    expect(screen.queryByRole('button', { name: 'Mark a rule' })).toBeNull();
    expect(screen.queryByText('Rules behind the mistakes')).toBeNull();
  });
});
