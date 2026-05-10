// Must be set before any module that imports env.ts
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.AUTH_COOKIE_SECRET = 'x'.repeat(32);
process.env.AUTH_SERVICE_URL = 'http://auth.test';
process.env.PROFILE_SERVICE_URL = 'http://profile.test';
process.env.CONTENT_SERVICE_URL = 'http://content.test';

import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './src/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
