import { expect } from 'vitest';

/**
 * Asserts the contract every markdown parser's `sourceIndexOf` must hold, so a
 * `LessonTextSpan`'s raw-markdown offsets can be projected onto rendered text
 * (spec 16 §2.3).
 *
 * The three parts, in the order they matter:
 *
 * 1. **Length is `text.length + 1`.** Ranges are half-open, so projecting
 *    `[a, b)` reads `sourceIndexOf[b]` — including when `b` is the last index.
 * 2. **Non-decreasing, and inside the input.** Projection inverts the map by
 *    scanning for the first output index at or past a source offset, which is
 *    only well defined if the map never goes backwards.
 * 3. **Characters agree.** A non-whitespace output character is the very
 *    character it points at. Whitespace is only required to point at
 *    whitespace: the block parser synthesises the space that joins a
 *    soft-wrapped line and the newline that joins quote lines, and neither has
 *    a source character of its own — each maps to the whitespace it replaced.
 *    Span endpoints never sit on whitespace (content-service refuses a
 *    whitespace-only snapshot, spec 16 §6.2), so the weaker rule for whitespace
 *    costs projection nothing.
 */
export function expectValidSourceMap(input: string, output: { text: string; sourceIndexOf: number[] }) {
  const { text, sourceIndexOf } = output;

  expect(sourceIndexOf).toHaveLength(text.length + 1);

  let previous = 0;
  for (const index of sourceIndexOf) {
    expect(index).toBeGreaterThanOrEqual(previous);
    expect(index).toBeLessThanOrEqual(input.length);
    previous = index;
  }

  for (let i = 0; i < text.length; i += 1) {
    const source = input[sourceIndexOf[i]!];
    if (/\s/.test(text[i]!)) {
      expect(source, `output[${i}] is whitespace but maps to ${JSON.stringify(source)}`).toMatch(/\s/);
    } else {
      expect(source, `output[${i}] = ${JSON.stringify(text[i])}`).toBe(text[i]);
    }
  }
}
