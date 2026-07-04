'use client';

import { useAuthoringExercises } from '../api/use-authoring-exercises';
import { useAuthoringGrammarRules } from '../api/use-authoring-grammar';
import { useAuthoringLessons } from '../api/use-authoring-lessons';
import { useAuthoringVocabularyLists } from '../api/use-authoring-vocabulary';
import type { SectionReadinessBadgeProps } from '../components/section-readiness-badge';

export type ModuleSection = 'readListen' | 'vocabulary' | 'grammar' | 'practice';

export type ModuleReadiness = Record<ModuleSection, SectionReadinessBadgeProps>;

export function useModuleReadiness(containerId: string): ModuleReadiness {
  const { data: lessons } = useAuthoringLessons(containerId);
  const { data: vocabLists } = useAuthoringVocabularyLists(containerId);
  const { data: grammarRules } = useAuthoringGrammarRules(containerId);
  const { data: exercises } = useAuthoringExercises(containerId);

  const readListen: SectionReadinessBadgeProps = (() => {
    if (!lessons || lessons.length === 0) return { state: 'empty' };
    return { state: 'ok' };
  })();

  const vocabulary: SectionReadinessBadgeProps = (() => {
    if (!vocabLists || vocabLists.length === 0) return { state: 'empty' };
    const first = vocabLists[0];
    if (!first || (first.itemCount ?? 0) === 0) return { state: 'empty' };
    return { state: 'ok' };
  })();

  const grammar: SectionReadinessBadgeProps = (() => {
    if (!grammarRules || grammarRules.length === 0) return { state: 'empty' };
    return { state: 'ok' };
  })();

  const practice: SectionReadinessBadgeProps = (() => {
    if (!exercises || exercises.length === 0) return { state: 'empty' };
    return { state: 'ok' };
  })();

  return { readListen, vocabulary, grammar, practice };
}
