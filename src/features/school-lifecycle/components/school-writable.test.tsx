import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { SchoolWritableProvider, WritableOnly } from './school-writable';

const button = <WritableOnly><button type="button">Create</button></WritableOnly>;

describe('WritableOnly (plan 90, live check, block 9)', () => {
  it('draws its children outside a workspace and in an active one', () => {
    const { rerender } = renderWithProviders(button);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    rerender(<SchoolWritableProvider status="active">{button}</SchoolWritableProvider>);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('keeps them when the status is unknown — the services still refuse', () => {
    renderWithProviders(<SchoolWritableProvider status={undefined}>{button}</SchoolWritableProvider>);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it.each(['suspended', 'closed', 'purged'] as const)('hides them in a %s workspace', (status) => {
    renderWithProviders(<SchoolWritableProvider status={status}>{button}</SchoolWritableProvider>);
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });
});
