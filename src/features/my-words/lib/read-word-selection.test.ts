import { afterEach, describe, expect, it } from 'vitest';

import { readWordSelection } from './read-word-selection';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

/** Selects `[from, to)` of the text node that holds `needle`. */
function select(root: HTMLElement, needle: string, from: number, to: number): Selection {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.includes(needle)) break;
  }
  const range = document.createRange();
  range.setStart(node!, from);
  range.setEnd(node!, to);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

describe('readWordSelection', () => {
  const html =
    '<div data-capture-paragraph="3"><p>Bartek kommer fra Polen. Han <strong>søker</strong> jobb.</p></div>' +
    '<p lang="ru">Бартек приехал из Польши.</p>';

  it('reads one word of a capturable paragraph with its sentence and paragraph', () => {
    const root = mount(html);
    const text = 'Bartek kommer fra Polen. Han ';
    const result = readWordSelection(
      select(root, 'Bartek', text.indexOf('kommer'), text.indexOf('kommer') + 6),
      root,
    );

    expect(result).toMatchObject({
      surfaceForm: 'kommer',
      paragraphIndex: 3,
      contextSentence: 'Bartek kommer fra Polen.',
    });
  });

  it('finds the sentence of a word inside emphasis', () => {
    const root = mount(html);
    const result = readWordSelection(select(root, 'søker', 0, 5), root);

    expect(result?.surfaceForm).toBe('søker');
    expect(result?.contextSentence).toBe('Han søker jobb.');
  });

  it('trims the space a double-click drags in', () => {
    const root = mount(html);
    const result = readWordSelection(select(root, 'Bartek', 6, 13), root);

    expect(result?.surfaceForm).toBe('kommer');
  });

  it('refuses a phrase', () => {
    const root = mount(html);
    expect(readWordSelection(select(root, 'Bartek', 0, 13), root)).toBeNull();
  });

  it('ignores the translation column', () => {
    const root = mount(html);
    expect(readWordSelection(select(root, 'Бартек', 0, 6), root)).toBeNull();
  });

  it('ignores a selection outside the reader', () => {
    mount(html);
    const elsewhere = mount('<div data-capture-paragraph="0">utenfor teksten</div>');
    const reader = document.body.firstElementChild as HTMLElement;
    expect(readWordSelection(select(elsewhere, 'utenfor', 0, 7), reader)).toBeNull();
  });
});
