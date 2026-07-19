/**
 * Blank-line paragraph split, mirroring content-service's
 * `MarkdownParagraphSplitterService` exactly so client-side paragraph indices
 * stay aligned with `LessonParagraphTranslation.paragraphIndex` (BE1.4).
 */
export function splitParagraphs(bodyMarkdown: string): string[] {
  if (!bodyMarkdown?.trim()) return [];
  return bodyMarkdown
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
