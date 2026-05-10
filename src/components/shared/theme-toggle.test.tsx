import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  it('renders with an accessible label', () => {
    const { getByRole } = renderWithProviders(<ThemeToggle />);
    expect(getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });
});
