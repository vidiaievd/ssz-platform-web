import { afterEach, describe, expect, it } from 'vitest';

import { wordAt } from './word-at-point';

function mount(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function textNode(root: HTMLElement, needle: string): Node {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) if (node.textContent?.includes(needle)) return node;
  throw new Error(`no text node with ${needle}`);
}

afterEach(() => {
  document.body.innerHTML = '';
});

const html =
  '<div data-capture-paragraph="3"><p>Bartek kommer fra Polen. Han sender en e-post.</p></div>' +
  '<p lang="ru">Бартек приехал из Польши.</p>';

describe('wordAt', () => {
  it('returns the whole word wherever in it the pointer is', () => {
    const root = mount(html);
    const node = textNode(root, 'kommer');
    const at = node.textContent!.indexOf('kommer');
    for (const offset of [at, at + 2, at + 5]) {
      expect(wordAt(node, offset, root)?.surfaceForm).toBe('kommer');
    }
  });

  it('takes the word a caret just past its last letter belongs to', () => {
    const root = mount(html);
    const node = textNode(root, 'kommer');
    expect(wordAt(node, node.textContent!.indexOf('kommer') + 6, root)?.surfaceForm).toBe('kommer');
  });

  it('keeps an inner hyphen and gives the sentence and paragraph', () => {
    const root = mount(html);
    const node = textNode(root, 'e-post');
    const result = wordAt(node, node.textContent!.indexOf('post'), root);
    expect(result).toMatchObject({
      surfaceForm: 'e-post',
      paragraphIndex: 3,
      contextSentence: 'Han sender en e-post.',
    });
  });

  it('is nothing between words', () => {
    const root = mount(html);
    const node = textNode(root, 'Polen');
    // The space after «Polen.»: a dot then a space, no letter on either side of the caret.
    expect(wordAt(node, node.textContent!.indexOf('Polen') + 6, root)).toBeNull();
  });

  it('ignores the translation column', () => {
    const root = mount(html);
    expect(wordAt(textNode(root, 'Бартек'), 2, root)).toBeNull();
  });
});
