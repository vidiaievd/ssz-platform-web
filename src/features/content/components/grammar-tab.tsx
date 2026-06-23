'use client';

import { useTranslations } from 'next-intl';

import { DataState } from '@/components/shared/data-state';
import { useContainerItems } from '../api/use-container-items';
import { useGrammarRule } from '../api/use-grammar-rule';
import { GrammarReader } from './grammar-reader';

interface GrammarTabProps {
  containerId: string;
  versionId?: string;
}

function GrammarRuleSection({ ruleId }: { ruleId: string }) {
  const { data: rule, isLoading, error } = useGrammarRule(ruleId);

  return (
    <DataState isLoading={isLoading} error={error ? { code: 'unknown' } : null} isEmpty={!rule}>
      {rule && <GrammarReader rule={rule} ruleId={ruleId} />}
    </DataState>
  );
}

export function GrammarTab({ containerId, versionId }: GrammarTabProps) {
  const t = useTranslations('Content');
  const { data, isLoading, error, refetch } = useContainerItems(
    containerId,
    versionId ?? '',
    !!versionId,
  );

  const items = (data ?? []).filter((i) => i.itemType === 'grammar_rule');

  return (
    <DataState
      isLoading={isLoading}
      error={error ? { code: 'unknown' } : null}
      isEmpty={!isLoading && items.length === 0}
      onRetry={() => void refetch()}
      emptySlot={
        <p className="text-muted-foreground py-8 text-center text-sm">{t('noGrammar')}</p>
      }
    >
      <div className="space-y-6">
        {items.map((item) => (
          <GrammarRuleSection key={item.id} ruleId={item.itemId} />
        ))}
      </div>
    </DataState>
  );
}
