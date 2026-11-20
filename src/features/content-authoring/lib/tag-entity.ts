/**
 * content-service addresses a taggable entity by a plural URL segment
 * (`/containers/:id/tags`); the editor names it in the singular.
 */
const TAG_ENTITY_SEGMENTS: Record<string, string> = {
  container: 'containers',
  lesson: 'lessons',
  vocabulary_list: 'vocabulary-lists',
  grammar_rule: 'grammar-rules',
  exercise: 'exercises',
};

export function tagEntitySegment(entityType: string): string | null {
  return TAG_ENTITY_SEGMENTS[entityType] ?? null;
}
