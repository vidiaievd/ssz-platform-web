#!/usr/bin/env node
/**
 * Verifies that every locale has the same set of keys as `en` for each
 * namespace. Exits 1 with a per-file report if any drift is found.
 *
 * Usage: node scripts/check-i18n-parity.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(import.meta.dirname, '..', 'messages');
const locales = readdirSync(root).filter((d) => !d.includes('.'));
const reference = 'en';
const others = locales.filter((l) => l !== reference);

/** Collect all dot-separated leaf key paths from a nested object. */
function leafKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...leafKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const namespaces = readdirSync(join(root, reference))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''));

let failures = 0;

for (const ns of namespaces) {
  const refPath = join(root, reference, `${ns}.json`);
  const refKeys = new Set(leafKeys(JSON.parse(readFileSync(refPath, 'utf8'))));

  for (const locale of others) {
    const localePath = join(root, locale, `${ns}.json`);
    let localeKeys;
    try {
      localeKeys = new Set(leafKeys(JSON.parse(readFileSync(localePath, 'utf8'))));
    } catch {
      console.error(`MISSING FILE: messages/${locale}/${ns}.json`);
      failures++;
      continue;
    }

    const missing = [...refKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !refKeys.has(k));

    if (missing.length > 0 || extra.length > 0) {
      failures++;
      console.error(`\nDRIFT: messages/${locale}/${ns}.json`);
      if (missing.length > 0) {
        console.error(`  Missing keys (in en, not in ${locale}):`);
        missing.forEach((k) => console.error(`    - ${k}`));
      }
      if (extra.length > 0) {
        console.error(`  Extra keys (in ${locale}, not in en):`);
        extra.forEach((k) => console.error(`    + ${k}`));
      }
    }
  }
}

if (failures === 0) {
  console.log(`i18n parity OK — ${namespaces.length} namespaces × ${locales.length} locales checked.`);
} else {
  console.error(`\n${failures} parity error(s) found.`);
  process.exit(1);
}
