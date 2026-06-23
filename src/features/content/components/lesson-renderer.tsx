/**
 * Renders lesson body content.
 *
 * Current implementation: plain-text rendering (safe, no XSS surface).
 * To add full Markdown support, install:
 *   npm install rehype-sanitize remark-parse remark-rehype unified rehype-stringify
 * Then replace the body element below with a unified pipeline.
 */
import type { LessonVariant } from '../types';

interface LessonRendererProps {
  variant: LessonVariant;
}

export function LessonRenderer({ variant }: LessonRendererProps) {
  return (
    <article className="prose dark:prose-invert max-w-none">
      <h1>{variant.displayTitle}</h1>
      <LessonBody body={variant.bodyMarkdown} />
    </article>
  );
}

function LessonBody({ body }: { body: string }) {
  // Split on blank lines to form paragraphs; preserves basic structure without a markdown library.
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="text-muted-foreground text-sm italic">(empty)</p>;
  }

  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {para}
        </p>
      ))}
    </>
  );
}
