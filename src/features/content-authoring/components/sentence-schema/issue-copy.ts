'use client';

import { useTranslations } from 'next-intl';

import type { ClauseId, Issue, SentenceSchemaContent } from '@/lib/shared-kernel/sentence-schema';

/**
 * Turns a validation code into a sentence in the teacher's language.
 *
 * The kernel carries codes and parameters and no prose: the same document is judged on
 * the server, where there is no locale, and the builder is translated into four languages
 * (plan 52 §5). This is the renderer on that side of the line — the same contract as the
 * six builders before it.
 *
 * The document is a parameter because every code but three names its subject by id, and
 * an id is not something a teacher can find on screen. Resolving it here turns it into the
 * position they are looking at: "Sentence 2", "Sentence 2 · Forfelt". A subject that has
 * since been deleted falls back to the unnumbered sentence rather than printing a stale
 * index — which is what makes it safe to hold an issue list across an edit.
 */
export function useIssueCopy(exercise: SentenceSchemaContent): (issue: Issue) => string {
  const t = useTranslations('Authoring');

  const rowNo = (id: string): number | null => {
    const found = exercise.rows.findIndex((row) => row.id === id);
    return found === -1 ? null : found + 1;
  };

  /** A field is named by its label, or by its short key when the author wrote no label. */
  const fieldName = (rowId: string, fieldId: string): string | null => {
    const row = exercise.rows.find((r) => r.id === rowId);
    if (!row) return null;
    const field = (exercise.schema[row.clause] ?? []).find((f) => f.id === fieldId);
    if (!field) return null;
    return field.label.trim() !== '' ? field.label : field.short;
  };

  const clauseName = (clause: ClauseId): string =>
    t(`sentenceSchema.clause.${clause}` as 'sentenceSchema.clause.main');

  return (issue: Issue): string => {
    switch (issue.code) {
      case 'NO_CLAUSE_ON':
        return t('sentenceSchema.issues.NO_CLAUSE_ON');

      case 'CLAUSE_NO_FIELDS':
        return t('sentenceSchema.issues.CLAUSE_NO_FIELDS', { clause: clauseName(issue.clause) });

      case 'ROW_CLAUSE_OFF': {
        const index = rowNo(issue.rowId);
        return index === null
          ? t('sentenceSchema.issues.ROW_CLAUSE_OFF_ANY', { clause: clauseName(issue.clause) })
          : t('sentenceSchema.issues.ROW_CLAUSE_OFF', {
              index,
              clause: clauseName(issue.clause),
            });
      }

      case 'NO_DELIVERABLE_ROWS':
        return t('sentenceSchema.issues.NO_DELIVERABLE_ROWS');

      case 'ROW_NO_TEXT': {
        const index = rowNo(issue.rowId);
        return index === null
          ? t('sentenceSchema.issues.ROW_NO_TEXT_ANY')
          : t('sentenceSchema.issues.ROW_NO_TEXT', { index });
      }

      case 'ROW_UNPLACED': {
        const index = rowNo(issue.rowId);
        return index === null
          ? t('sentenceSchema.issues.ROW_UNPLACED_ANY', { count: issue.count })
          : t('sentenceSchema.issues.ROW_UNPLACED', { index, count: issue.count });
      }

      // Both names or neither: a field name without its sentence points at a column the
      // teacher cannot locate, which is worse than the unnumbered sentence.
      case 'ROW_REQUIRED_FIELD_EMPTY': {
        const index = rowNo(issue.rowId);
        const field = fieldName(issue.rowId, issue.fieldId);
        return index === null || field === null
          ? t('sentenceSchema.issues.ROW_REQUIRED_FIELD_EMPTY_ANY')
          : t('sentenceSchema.issues.ROW_REQUIRED_FIELD_EMPTY', { index, field });
      }

      case 'ROW_V2_VIOLATION': {
        const index = rowNo(issue.rowId);
        const field = fieldName(issue.rowId, issue.fieldId);
        return index === null || field === null
          ? t('sentenceSchema.issues.ROW_V2_VIOLATION_ANY', { count: issue.count })
          : t('sentenceSchema.issues.ROW_V2_VIOLATION', {
              index,
              field,
              count: issue.count,
            });
      }

      case 'EXTRAS_ON_BUT_NONE':
        return t('sentenceSchema.issues.EXTRAS_ON_BUT_NONE');

      case 'ROW_NO_WHY': {
        const index = rowNo(issue.rowId);
        return index === null
          ? t('sentenceSchema.issues.ROW_NO_WHY_ANY')
          : t('sentenceSchema.issues.ROW_NO_WHY', { index });
      }
    }
  };
}
