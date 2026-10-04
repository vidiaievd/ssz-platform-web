import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';
import { emptyContent, newSegment, type DictationContent } from '@/lib/shared-kernel/dictation';

import { DictationPreview } from './dictation-preview';

vi.mock('@/features/media', () => ({
  useMediaAsset: () => ({ data: undefined }),
  uploadAsset: vi.fn(),
}));

function keyed(patch: Partial<DictationContent> = {}): DictationContent {
  const base = emptyContent('nb', 'Skriv det du hører.');
  return {
    ...base,
    title: 'Diktat: kj',
    audio: { ...base.audio, duration: 30 },
    segments: [
      {
        ...newSegment(),
        id: 's1',
        text: 'Jeg hørte kjøkkenet.',
        why: 'kj, ikke sj.',
        focus: [{ id: 'f1', wordIndex: 2, why: 'kj + øk' }],
      },
      { ...newSegment(), id: 's2', text: 'Hun gikk hjem.', why: 'Dobbel m.' },
      newSegment(),
    ],
    ...patch,
  };
}

const client = new QueryClient();

function wrap(content: DictationContent) {
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DictationPreview exercise={content} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function draw(content = keyed()) {
  return render(wrap(content));
}

describe('DictationPreview', () => {
  it('hands the student the written sentences and none of the key', () => {
    const { container } = draw();
    expect(screen.getByText('Sentence 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Skriv det du hører.')).toBeInTheDocument();
    expect(container.textContent).not.toContain('kjøkkenet');
    expect(container.textContent).not.toContain('kj, ikke sj.');
  });

  it('judges a check with the kernel — a real verdict, the reason after a failure', async () => {
    const { container } = draw();
    await userEvent.type(screen.getByRole('textbox'), 'Jeg hørte sjøkkenet');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));

    const wrong = container.querySelector('[data-s="wrong"]');
    expect(wrong).toHaveTextContent('sjøkkenet');
    expect(wrong).toHaveTextContent('kjøkkenet');
    // A focus word is named, never «almost right» — and the reason comes with the failure.
    expect(wrong).toHaveAttribute('data-focus', 'true');
    expect(container.textContent).toContain('kj, ikke sj.');
  });

  it('may be checked again at once — there is no server to protect', async () => {
    draw();
    const field = screen.getByRole('textbox');
    await userEvent.type(field, 'Jeg');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Attempt 2 of 2')).toBeInTheDocument();
  });

  it('switches between phone, desktop and the reader card (Q6-A)', async () => {
    const { container } = draw();
    expect(container.querySelector('[data-layout="phone"]')).not.toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Web' }));
    expect(container.querySelector('[data-layout="desktop"]')).not.toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: 'Reader' }));
    const card = screen.getByRole('region', { name: 'Diktat: kj' });
    expect(card).toHaveTextContent('2 sentences');
    expect(card).toHaveTextContent('0:30');
    expect(card).toHaveTextContent('3 playbacks');
    expect(card.textContent).not.toContain('kjøkkenet');
  });

  it('draws everything and accepts nothing in Static', async () => {
    draw();
    await userEvent.click(screen.getByRole('radio', { name: 'Static' }));
    const field = screen.getByRole('textbox');
    expect(field).toSatisfy(
      (el: HTMLElement) => el.hasAttribute('disabled') || el.hasAttribute('readonly'),
    );
  });

  it('restarts the attempt', async () => {
    draw();
    await userEvent.type(screen.getByRole('textbox'), 'Jeg');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restart the attempt' }));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('starts again when what the student is handed changes', async () => {
    const view = draw();
    await userEvent.type(screen.getByRole('textbox'), 'Jeg');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    view.rerender(wrap(keyed({ settings: { ...keyed().settings, attempts: 3 } })));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('says what it needs when nothing is written', () => {
    draw(emptyContent('nb'));
    expect(
      screen.getByText('Write a sentence on step 2 to see what a student is handed.'),
    ).toBeInTheDocument();
  });
});
