import { describe, expect, it } from 'vitest';

import { applyMarkdownFormat } from './markdown-format-menu';

describe('applyMarkdownFormat', () => {
  it('wraps the selection in bold markers and selects the inner text', () => {
    const r = applyMarkdownFormat('bold', 'en vanlig dag', 3, 9); // "vanlig"
    expect(r.value).toBe('en **vanlig** dag');
    expect(r.value.slice(r.selStart, r.selEnd)).toBe('vanlig');
  });

  it('wraps the selection in italic markers', () => {
    const r = applyMarkdownFormat('italic', 'hei verden', 4, 10); // "verden"
    expect(r.value).toBe('hei _verden_');
    expect(r.value.slice(r.selStart, r.selEnd)).toBe('verden');
  });

  it('inserts a placeholder when there is no selection', () => {
    const r = applyMarkdownFormat('bold', 'ab', 1, 1);
    expect(r.value).toBe('a**bold text**b');
    expect(r.value.slice(r.selStart, r.selEnd)).toBe('bold text');
  });

  it('prefixes the caret line for a heading', () => {
    const r = applyMarkdownFormat('heading', 'line one\nline two', 10, 10); // caret on line two
    expect(r.value).toBe('line one\n## line two');
  });

  it('prefixes every selected line for a bulleted list', () => {
    const value = 'first\nsecond';
    const r = applyMarkdownFormat('list', value, 0, value.length);
    expect(r.value).toBe('- first\n- second');
  });

  it('prefixes the selected line for a quote from the line start', () => {
    const r = applyMarkdownFormat('quote', 'intro\nquoted line', 9, 13); // partial selection on line two
    expect(r.value).toBe('intro\n> quoted line');
  });
});

describe('applyMarkdownFormat — dialogue and tables', () => {
  it('opens a turn on a paragraph of its own, with the name selected to type over', () => {
    const value = 'Taras åpner dokumentet.';
    const r = applyMarkdownFormat('dialogue', value, value.length, value.length);
    expect(r.value).toBe('Taras åpner dokumentet.\n\n**Navn:** ');
    expect(r.value.slice(r.selStart, r.selEnd)).toBe('Navn');
  });

  it('turns a selected line into what the speaker says', () => {
    const value = 'Intro.\n\nHer holder det med én side.\n\nSlutt.';
    const start = value.indexOf('Her');
    const end = value.indexOf('side.') + 'side.'.length;
    const r = applyMarkdownFormat('dialogue', value, start, end);
    expect(r.value).toBe('Intro.\n\n**Navn:** Her holder det med én side.\n\nSlutt.');
  });

  it('inserts a table between blank lines, the first column name selected', () => {
    const r = applyMarkdownFormat('table', 'Før.\nEtter.', 4, 4);
    expect(r.value).toBe('Før.\n\n| Kolonne 1 | Kolonne 2 |\n|---|---|\n|  |  |\n\nEtter.');
    expect(r.value.slice(r.selStart, r.selEnd)).toBe('Kolonne 1');
  });
});
