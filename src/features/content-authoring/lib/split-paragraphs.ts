/**
 * Blank-line paragraph split, mirroring content-service's `MarkdownParagraphSplitterService`.
 *
 * The implementation moved into the shared kernel (plan 67, decision Q2-A) so that the
 * server and this client split a passage with one build — `highlight_in_text` grades marks
 * against these paragraphs on both sides. This file stays as the path the authoring code
 * already imports from.
 */
export type { ParagraphWithOffsets } from '@/lib/shared-kernel/text';
export { splitParagraphs, splitParagraphsWithOffsets } from '@/lib/shared-kernel/text';
