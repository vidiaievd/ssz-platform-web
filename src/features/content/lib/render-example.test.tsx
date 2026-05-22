import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { renderExample } from './render-example';

function renderNodes(nodes: React.ReactNode[]) {
  return render(<span>{nodes}</span>);
}

describe('renderExample', () => {
  it('replaces a single ___ with bolded substitution', () => {
    const nodes = renderExample('Jeg heter ___', 'Anna');
    const { container } = renderNodes(nodes);
    expect(container.textContent).toBe('Jeg heter Anna');
    expect(container.querySelector('strong')?.textContent).toBe('Anna');
  });

  it('replaces multiple ___ occurrences', () => {
    const nodes = renderExample('___ og ___', 'Anna');
    const { container } = renderNodes(nodes);
    expect(container.querySelectorAll('strong')).toHaveLength(2);
    expect(container.textContent).toBe('Anna og Anna');
  });

  it('returns the template unchanged when no placeholder is present', () => {
    const nodes = renderExample('Ingen plassholder her', 'Anna');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toBe('Ingen plassholder her');
  });

  it('handles empty template', () => {
    const nodes = renderExample('', 'Anna');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toBe('');
  });

  it('handles ___ at the start of the template', () => {
    const nodes = renderExample('___ er bra', 'Det');
    const { container } = renderNodes(nodes);
    expect(container.textContent).toBe('Det er bra');
    expect(container.querySelector('strong')?.textContent).toBe('Det');
  });

  it('handles ___ at the end of the template', () => {
    const nodes = renderExample('Hunden heter ___', 'Rex');
    const { container } = renderNodes(nodes);
    expect(container.textContent).toBe('Hunden heter Rex');
  });

  it('handles empty substitution', () => {
    const nodes = renderExample('Hei ___!', '');
    const { container } = renderNodes(nodes);
    expect(container.querySelector('strong')?.textContent).toBe('');
  });
});
