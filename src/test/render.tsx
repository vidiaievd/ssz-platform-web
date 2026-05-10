import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import en from '../../messages/en.json';

export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type AllProvidersProps = { children: ReactNode; locale?: string };

function AllProviders({ children, locale = 'en' }: AllProvidersProps) {
  const client = makeTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={en}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & { locale?: string },
) {
  const { locale, ...rest } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => <AllProviders locale={locale}>{children}</AllProviders>,
    ...rest,
  });
}
