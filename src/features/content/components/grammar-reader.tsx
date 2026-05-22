'use client';

import { DataState } from '@/components/shared/data-state';
import { useBestGrammarExplanation } from '../api/use-grammar-rule';
import type { GrammarRule } from '../types';

interface GrammarReaderProps {
  rule: GrammarRule;
  ruleId: string;
}

export function GrammarReader({ rule, ruleId }: GrammarReaderProps) {
  const { data: explanation, isLoading, error, refetch } = useBestGrammarExplanation(ruleId);

  return (
    <div className="rounded-lg border p-5">
      <h3 className="mb-3 text-base font-semibold">{rule.title}</h3>

      <DataState
        isLoading={isLoading}
        error={error ? { code: 'unknown' } : null}
        isEmpty={!isLoading && !explanation}
        onRetry={() => void refetch()}
      >
        {explanation && (
          <div className="space-y-3">
            {explanation.title !== rule.title && (
              <p className="text-muted-foreground text-sm font-medium">{explanation.title}</p>
            )}
            <div className="prose dark:prose-invert text-sm max-w-none">
              {explanation.body.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {para.trim()}
                </p>
              ))}
            </div>
            {explanation.examples && explanation.examples.length > 0 && (
              <ul className="border-l-2 pl-4 space-y-1">
                {explanation.examples.map((ex, i) => (
                  <li key={i} className="text-muted-foreground text-sm italic">
                    {ex}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
