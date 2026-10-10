'use client';

import { useTranslations } from 'next-intl';

import type { FieldType, Issue } from '@/lib/shared-kernel/information-transfer';

/** The issues steps 1 and 2 draw — the rest get their words in phase 7 with their steps. */
export type SourceOrFormIssue =
  | Extract<Issue, { step: 1 | 2 }>
  | Extract<Issue, { code: 'INF_KEY_UNREADABLE' }>;

export function isSourceOrForm(issue: Issue): issue is SourceOrFormIssue {
  return issue.step === 1 || issue.step === 2 || issue.code === 'INF_KEY_UNREADABLE';
}

export interface IssueCopy {
  /**
   * What is wrong, in the teacher's language. `bare` is for a line drawn on the field's own
   * card, where «Field 2 («Klokkeslett»)» would name what the reader is already looking at.
   */
  describe: (issue: SourceOrFormIssue, options?: { bare?: boolean }) => string;
  /** The label of the button that goes and fixes it — the prototype's `fix`. */
  fix: (issue: SourceOrFormIssue) => string;
}

/**
 * The label of a field type, spelled out — no key is built from the type (a dynamic key
 * is a tsc hazard in this repo, and a type added later must fail here, not at runtime).
 */
export function useTypeLabel(): (type: FieldType) => string {
  const t = useTranslations('Authoring.informationTransfer.types');
  return (type) => {
    switch (type) {
      case 'time':
        return t('time.label');
      case 'date':
        return t('date.label');
      case 'number':
        return t('number.label');
      case 'money':
        return t('money.label');
      case 'phone':
        return t('phone.label');
      case 'name':
        return t('name.label');
      case 'word':
        return t('word.label');
    }
  };
}

/** The one-line description of a field type, shown under the select. */
export function useTypeDescription(): (type: FieldType) => string {
  const t = useTranslations('Authoring.informationTransfer.types');
  return (type) => {
    switch (type) {
      case 'time':
        return t('time.desc');
      case 'date':
        return t('date.desc');
      case 'number':
        return t('number.desc');
      case 'money':
        return t('money.desc');
      case 'phone':
        return t('phone.desc');
      case 'name':
        return t('name.desc');
      case 'word':
        return t('word.desc');
    }
  };
}

/**
 * The words for a kernel issue (plan 73, phase 6).
 *
 * The kernel names what is wrong and where — a code, a field id, the parameters — and never
 * the sentence, so the rail, the steps and the gate say the same thing (INF-B1). A field is
 * called by its place and its label: «Field 2 («Klokkeslett»)».
 */
export function useIssueCopy(): IssueCopy {
  const t = useTranslations('Authoring.informationTransfer');
  const typeLabel = useTypeLabel();

  const subjectOf = (issue: SourceOrFormIssue, bare: boolean): string => {
    if (!('fieldId' in issue)) return '';
    if (bare) return t('subject.thisField');
    const label = 'label' in issue ? issue.label : '';
    return label === ''
      ? t('subject.field', { n: issue.n })
      : t('subject.fieldLabelled', { n: issue.n, label });
  };

  return {
    describe: (issue, options = {}) =>
      t(`issues.${issue.code}` as 'issues.INF_NO_PASSAGE', {
        subject: subjectOf(issue, options.bare === true),
        label: 'label' in issue ? issue.label : '',
        value: 'value' in issue ? issue.value : '',
        language: 'language' in issue ? issue.language : '',
        count: 'count' in issue ? issue.count : 0,
        min: 'min' in issue ? issue.min : 0,
        max: 'max' in issue ? issue.max : 0,
        type: issue.code === 'INF_KEY_UNREADABLE' ? typeLabel(issue.type).toLowerCase() : '',
      }),
    fix: (issue) => t(`fixes.${issue.code}` as 'fixes.INF_NO_PASSAGE'),
  };
}
