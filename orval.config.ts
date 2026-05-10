import { defineConfig } from 'orval';

/**
 * Generates from the aggregated OpenAPI spec exposed by api-docs-service.
 * Until the gateway is live, point this to a local file you save manually:
 *   curl http://localhost:8080/api/docs/openapi.json -o openapi/spec.json
 */
export default defineConfig({
  'ssz-platform': {
    input: { target: './openapi/spec.json' },
    output: {
      mode: 'tags-split',
      target: './src/lib/api/generated',
      schemas: './src/lib/api/generated/schemas',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      formatter: 'prettier',
      override: {
        mutator: {
          path: './src/lib/api/custom-fetcher.ts',
          name: 'customFetcher',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          signal: true,
        },
      },
    },
  },
});
