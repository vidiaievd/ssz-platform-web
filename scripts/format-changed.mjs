#!/usr/bin/env node
/**
 * Run Prettier over the files you are actually working on.
 *
 * The repository predates its Prettier config: most files have never been run
 * through it, so `prettier --write .` would rewrite well over half the tree and
 * bury a real change in thousands of lines of reflow. This formats only what
 * git already reports as changed — staged, unstaged and untracked — which
 * converges the codebase one commit at a time without a big-bang diff.
 *
 *   node scripts/format-changed.mjs            # write
 *   node scripts/format-changed.mjs --check    # report, exit 1 if unformatted
 *
 * Pass an explicit base to widen the net to a whole branch:
 *   node scripts/format-changed.mjs --since origin/master
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const check = args.includes('--check');
const sinceIndex = args.indexOf('--since');
const since = sinceIndex === -1 ? null : args[sinceIndex + 1];

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });

/** Extensions Prettier owns here. Anything else it would only pass through. */
const FORMATTABLE = /\.(m?[jt]sx?|css|json|md|ya?ml)$/;

function changedFiles() {
  const out = new Set();
  const add = (list) =>
    list
      .split('\n')
      .filter(Boolean)
      .forEach((f) => out.add(f));

  if (since) {
    const base = git('merge-base', since, 'HEAD').trim();
    add(git('diff', '--name-only', '--diff-filter=d', base));
  }
  add(git('diff', '--name-only', '--diff-filter=d')); // unstaged
  add(git('diff', '--name-only', '--diff-filter=d', '--cached')); // staged
  add(git('ls-files', '--others', '--exclude-standard')); // untracked

  return [...out].filter((f) => FORMATTABLE.test(f));
}

const files = changedFiles();

if (files.length === 0) {
  console.log('Nothing changed — no files to format.');
  process.exit(0);
}

try {
  // Prettier skips anything matched by .prettierignore on its own.
  execFileSync('npx', ['prettier', check ? '--check' : '--write', ...files], {
    stdio: 'inherit',
  });
} catch {
  // Prettier already printed the offending files; --check failing is the point.
  process.exit(1);
}
