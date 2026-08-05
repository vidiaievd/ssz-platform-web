// Must be set before any module that imports env.ts
// Clear the gateway so tests use per-service URLs (mirrors prod structure for action tests)
delete process.env.API_GATEWAY_URL;
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.AUTH_COOKIE_SECRET = 'x'.repeat(32);
process.env.AUTH_SERVICE_URL = 'http://auth.test';
process.env.PROFILE_SERVICE_URL = 'http://profile.test';
process.env.CONTENT_SERVICE_URL = 'http://content.test';
process.env.ORGANIZATION_SERVICE_URL = 'http://organization.test';
process.env.ANALYTICS_SERVICE_URL = 'http://analytics.test';

import '@testing-library/jest-dom/vitest';

// Radix UI uses ResizeObserver (e.g. Select, ScrollArea); JSDOM doesn't provide it.
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
// `useMediaQuery` (reader rail, responsive layouts) calls this on mount; JSDOM
// has no implementation at all. Defaults to "does not match", so a component
// under test renders its narrow-viewport branch unless a test stubs otherwise.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './src/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
