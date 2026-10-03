import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { enMessages } from '@/lib/i18n/messages';

import { BlockTypeIcon } from './block-type-icon';

function draw(props: React.ComponentProps<typeof BlockTypeIcon>) {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BlockTypeIcon {...props} />
    </NextIntlClientProvider>,
  );
  const tile = container.firstElementChild as HTMLElement;
  return { tile, glyph: tile.querySelector('svg')?.getAttribute('class') ?? '' };
}

describe('BlockTypeIcon', () => {
  // The complaint the phase answers: a section of twelve exercises used to be
  // twelve identical targets.
  it('draws two exercise templates as two different pictures', () => {
    const gapFill = draw({ kind: 'exercise', templateCode: 'word_bank_gap_fill' });
    const translate = draw({ kind: 'exercise', templateCode: 'translate_to_target' });

    expect(gapFill.glyph).not.toBe(translate.glyph);
    expect(gapFill.tile).toHaveAttribute('title', 'Gap-fill');
    expect(translate.tile).toHaveAttribute('title', 'Translate to target');
  });

  it('falls back to the generic exercise glyph for a template it does not know', () => {
    const unknown = draw({ kind: 'exercise', templateCode: 'dictation_v2' });
    const plain = draw({ kind: 'exercise', templateCode: null });

    expect(unknown.glyph).toBeTruthy();
    expect(unknown.glyph).toBe(plain.glyph);
    expect(unknown.tile).toHaveAttribute('title', 'Practice');
  });

  // Colour says section, picture says type — a lesson never wears a template's
  // drawing, whatever a stray field says.
  it('ignores a template code on material that is not an exercise', () => {
    const lesson = draw({ kind: 'text', templateCode: 'match_pairs' });
    const plainLesson = draw({ kind: 'text' });

    expect(lesson.glyph).toBe(plainLesson.glyph);
    expect(lesson.tile).toHaveAttribute('title', 'Reading');
  });

  it('is decorative: the row already says in words what it holds', () => {
    const { tile } = draw({ kind: 'exercise', templateCode: 'match_pairs' });
    expect(tile).toHaveAttribute('aria-hidden');
  });
});
