import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src/features/analytics');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/**
 * The tutor contour (plan 59) reuses every one of these components, and it has no school
 * and no school groups at all. An import of either feature would compile perfectly and
 * only fail when somebody tried to show a private tutor their learners.
 */
describe('the visual layer stays free of the school contour', () => {
  const sources = filesUnder(ROOT).filter(
    (path) => /\.tsx?$/.test(path) && !path.includes('.test.'),
  );

  it('has files to check', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each(sources.map((path) => [path.slice(ROOT.length + 1), path]))(
    '%s imports neither features/groups nor features/school',
    (_name, path) => {
      const source = readFileSync(path, 'utf8');

      expect(source).not.toMatch(/from\s+['"]@\/features\/(groups|school)/);
      expect(source).not.toMatch(/from\s+['"]\.\.\/\.\.\/(groups|school)/);
    },
  );
});
