import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig = {};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when SENTRY_AUTH_TOKEN is present (i.e. in CI).
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Disable the Sentry telemetry call on every build.
  telemetry: false,
  // Tree-shake Sentry debug code in production bundles.
  disableLogger: true,
});
