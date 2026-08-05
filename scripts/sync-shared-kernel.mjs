#!/usr/bin/env node
/**
 * Vendor `@ssz/shared-kernel` source into this repository.
 *
 * The kernel holds logic the backend and this client must agree on byte for byte
 * (AC-X1: "client and server validation return the same codes for the same
 * document"). It lives in the `ssz-platform` repository, which this one cannot
 * depend on: Vercel builds this repository alone, so a `file:` dependency
 * pointing outside it will not install.
 *
 * So the source is copied in, mechanically, and the copy is committed. Each
 * generated file carries a DO-NOT-EDIT header; `--check` fails when the copy and
 * the source disagree. Drift is a failing check, not a judgement call.
 *
 *   node scripts/sync-shared-kernel.mjs           # write the copy
 *   node scripts/sync-shared-kernel.mjs --check   # verify, exit 1 on drift
 *
 * The source repository is expected as a sibling directory (the `docker:dev`
 * script already assumes that layout). Override with SSZ_PLATFORM_PATH.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sourceRoot = path.resolve(
  process.env.SSZ_PLATFORM_PATH ?? path.join(repoRoot, '..', 'ssz-platform'),
  'packages/shared-kernel/src',
);
const targetRoot = path.join(repoRoot, 'src/lib/shared-kernel');

const check = process.argv.slice(2).includes('--check');

/** Prepended to every copied file. Regenerated on read, so it never drifts either. */
function header(relativePath) {
  return [
    '// ---------------------------------------------------------------------------',
    '// GENERATED FILE — DO NOT EDIT.',
    `// Source: ssz-platform/packages/shared-kernel/src/${relativePath}`,
    '// Regenerate with `npm run kernel:sync`; verify with `npm run kernel:check`.',
    '// ---------------------------------------------------------------------------',
    '',
    '',
  ].join('\n');
}

/** Relative paths of every `.ts` file under `dir`, sorted, POSIX separators. */
async function collect(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      files.push(...(await collect(path.join(dir, entry.name), relativePath)));
    else if (entry.name.endsWith('.ts')) files.push(relativePath);
  }
  return files.sort();
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(sourceRoot)) {
  // On a machine or a CI job that only has this repository, there is nothing to
  // compare against. The committed copy is what builds, so this is not an error
  // there — but it does mean the guard did not run, and that must be visible.
  const message = `shared-kernel source not found at ${sourceRoot}`;
  if (check) {
    console.warn(`⚠ ${message} — skipping the drift check (set SSZ_PLATFORM_PATH to run it).`);
    process.exit(0);
  }
  fail(`${message}. Set SSZ_PLATFORM_PATH to the ssz-platform checkout.`);
}

const sourceFiles = await collect(sourceRoot);
const targetFiles = existsSync(targetRoot) ? await collect(targetRoot) : [];

const drift = [];
let written = 0;

for (const relativePath of sourceFiles) {
  const expected =
    header(relativePath) + (await readFile(path.join(sourceRoot, relativePath), 'utf8'));
  const targetPath = path.join(targetRoot, relativePath);
  const actual = existsSync(targetPath) ? await readFile(targetPath, 'utf8') : null;

  if (actual === expected) continue;

  if (check) {
    drift.push(`${actual === null ? 'missing' : 'stale'}: src/lib/shared-kernel/${relativePath}`);
    continue;
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, expected, 'utf8');
  written += 1;
}

// A file deleted upstream must disappear here too, or it keeps compiling forever.
for (const relativePath of targetFiles) {
  if (sourceFiles.includes(relativePath)) continue;
  if (check) drift.push(`orphaned: src/lib/shared-kernel/${relativePath}`);
  else {
    await rm(path.join(targetRoot, relativePath));
    written += 1;
  }
}

if (check) {
  if (drift.length) {
    console.error('✗ src/lib/shared-kernel is out of sync with @ssz/shared-kernel:\n');
    for (const line of drift) console.error(`    ${line}`);
    console.error('\n  Run `npm run kernel:sync` and commit the result.');
    process.exit(1);
  }
  console.log(`✓ shared-kernel in sync (${sourceFiles.length} files)`);
} else {
  console.log(
    written === 0
      ? `✓ shared-kernel already up to date (${sourceFiles.length} files)`
      : `✓ synced shared-kernel: ${written} file(s) changed, ${sourceFiles.length} total`,
  );
}
